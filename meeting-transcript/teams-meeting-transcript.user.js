// ==UserScript==
// @name         Teams meeting transcript export
// @namespace    https://github.com/koadjunky/teams-export
// @version      1.0.0
// @description  Export the full transcript of a Teams meeting as Markdown, also when Download is disabled.
// @author       koadjunky
// @license      Apache-2.0
// @match        https://teams.microsoft.com/*
// @match        https://teams.cloud.microsoft/*
// @match        https://teams.live.com/*
// @match        https://*.sharepoint.com/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/koadjunky/teams-export/main/meeting-transcript/teams-meeting-transcript.user.js
// @downloadURL  https://raw.githubusercontent.com/koadjunky/teams-export/main/meeting-transcript/teams-meeting-transcript.user.js
// ==/UserScript==

// The transcript panel is a virtualized list: only the rows on screen exist in the DOM, so
// copy/paste captures one screenful. This script scrolls the panel from top to bottom, collects
// every entry, sorts entries by timestamp and saves them as a Markdown file.
//
// The same file works pasted into the DevTools console (no userscript manager needed).
// It expects the English Teams UI ("Name 3 minutes 12 seconds" entry headers).

(function () {
  'use strict';

  const SCROLL_STEP = 0.7;      // fraction of the visible height scrolled per step
  const RENDER_WAIT_MS = 400;   // time for the list to render after each scroll
  const STALL_LIMIT = 5;        // steps without movement before we assume the end
  const GAP_WARN_SECONDS = 30;  // consecutive entries further apart than this are reported

  // ---------------------------------------------------------------- parsing (pure, testable)

  const DURATION = /^(?:(\d+) hours?)?\s*(?:(\d+) minutes?)?\s*(?:(\d+) seconds?)?$/;
  const HEADER = /^(.+?) ((?:\d+ hours?)(?: \d+ minutes?)?(?: \d+ seconds?)?|\d+ minutes?(?: \d+ seconds?)?|\d+ seconds?)$/;
  const CLOCK = /^\d{1,2}(?::\d{2}){1,2}$/;
  const INITIALS = /^[A-Z]{1,3}$/;
  const EVENT = /^(started|stopped) transcription$/;
  const OBJECT_REPLACEMENT = '￼';

  function toSeconds(text) {
    const m = DURATION.exec(text.trim());
    if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
    return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  }

  function parseHeader(line) {
    if (toSeconds(line) !== null) return null;          // a bare duration, not a header
    const m = HEADER.exec(line);
    if (!m) return null;
    const seconds = toSeconds(m[2]);
    return seconds === null ? null : { speaker: m[1], seconds };
  }

  // Feed the visible text of one render into the collector state.
  // state = { entries: Map<key, {speaker, seconds, order, lines[]}>, events: [], speakers: Set, order }
  function ingest(state, text) {
    const lines = text.split('\n').map(s => s.trim()).filter(s => s && s !== OBJECT_REPLACEMENT);

    // Teams renders every speaker change as "Name" followed by a bare duration ("0 minutes 11
    // seconds"). Speakers are learnt only from that pattern, so a spoken line that merely ends
    // with a duration ("Give me 5 minutes") is never mistaken for an entry header.
    for (let i = 0; i + 1 < lines.length; i++) {
      if (toSeconds(lines[i + 1]) !== null && toSeconds(lines[i]) === null && !CLOCK.test(lines[i])) {
        state.speakers.add(lines[i]);
      }
    }

    let current = null;
    let lastBareName = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const h = parseHeader(l);
      if (h && state.speakers.has(h.speaker)) {
        const key = h.speaker + '|' + h.seconds;
        if (!state.entries.has(key)) {
          state.entries.set(key, { speaker: h.speaker, seconds: h.seconds, order: state.order++, lines: [] });
        }
        current = state.entries.get(key);
        continue;
      }
      if (state.speakers.has(l)) { lastBareName = l; continue; }
      if (INITIALS.test(l) && state.speakers.has(lines[i + 1])) continue;
      if (toSeconds(l) !== null || CLOCK.test(l)) continue;
      const ev = EVENT.exec(l);
      if (ev) {
        const who = lastBareName || 'Someone';
        const key = who + '|' + ev[1];
        if (!state.events.some(e => e.key === key)) {
          state.events.push({ key, text: `${who} ${ev[1]} transcription`, after: current ? current.seconds : 0 });
        }
        continue;
      }
      if (current && !current.lines.includes(l)) current.lines.push(l);
    }
  }

  function newState() {
    return { entries: new Map(), events: [], speakers: new Set(), order: 0 };
  }

  function fmt(seconds) {
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }

  function sortedEntries(state) {
    return [...state.entries.values()]
      .filter(e => e.lines.length)
      .sort((a, b) => a.seconds - b.seconds || a.order - b.order);
  }

  function findGaps(entries, threshold = GAP_WARN_SECONDS) {
    const gaps = [];
    for (let i = 1; i < entries.length; i++) {
      const d = entries[i].seconds - entries[i - 1].seconds;
      if (d > threshold) gaps.push({ from: entries[i - 1].seconds, to: entries[i].seconds });
    }
    return gaps;
  }

  function toMarkdown(state, title, exportedAt) {
    const entries = sortedEntries(state);
    const out = [`# ${title}`, '', `Exported ${exportedAt} from the Teams transcript panel. ` +
      'Teams transcripts are AI-generated and may contain recognition errors.', ''];
    let ev = 0;
    const events = [...state.events].sort((a, b) => a.after - b.after);
    for (const e of entries) {
      while (ev < events.length && events[ev].after < e.seconds) out.push(`_${events[ev++].text}._`, '');
      out.push(`**${e.speaker}** [${fmt(e.seconds)}]`, e.lines.join(' '), '');
    }
    while (ev < events.length) out.push(`_${events[ev++].text}._`, '');
    return out.join('\n');
  }

  // ---------------------------------------------------------------- browser part

  function findPanel() {
    let best = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollHeight <= el.clientHeight + 50) continue;
      const style = getComputedStyle(el);
      if (!/(auto|scroll)/.test(style.overflowY)) continue;
      const headers = (el.innerText || '').split('\n').filter(l => parseHeader(l.trim())).length;
      if (headers < 2) continue;
      // Prefer the innermost element that still holds the list: it is the one that scrolls.
      if (!best || best.el.contains(el)) best = { el, headers };
    }
    return best && best.el;
  }

  function meetingTitle() {
    const t = (document.title || '')
      .replace(/\s*[|\-–]\s*Microsoft Teams.*$/i, '')
      .replace(/^\(\d+\)\s*/, '')
      .trim();
    return t || 'Teams meeting';
  }

  function slug(s) {
    return s.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'meeting';
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function exportTranscript(onProgress = () => {}) {
    const panel = findPanel();
    if (!panel) throw new Error('Transcript panel not found. Open the meeting transcript and try again.');
    const state = newState();
    const startScroll = panel.scrollTop;
    panel.scrollTop = 0;
    await sleep(RENDER_WAIT_MS);
    for (let stall = 0; stall < STALL_LIMIT;) {
      ingest(state, panel.innerText);
      onProgress(state.entries.size);
      const before = panel.scrollTop;
      panel.scrollTop += panel.clientHeight * SCROLL_STEP;
      await sleep(RENDER_WAIT_MS);
      stall = panel.scrollTop === before ? stall + 1 : 0;
    }
    ingest(state, panel.innerText);
    panel.scrollTop = startScroll;

    const entries = sortedEntries(state);
    if (!entries.length) throw new Error('No transcript entries recognised (is the Teams UI in English?).');
    const title = meetingTitle();
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    const markdown = toMarkdown(state, title, stamp);
    const filename = `transcript_${slug(title)}_${stamp}.md`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.__teamsTranscript = markdown;

    const gaps = findGaps(entries);
    return {
      filename, count: entries.length, speakers: new Set(entries.map(e => e.speaker)).size,
      first: entries[0].seconds, last: entries[entries.length - 1].seconds, gaps,
    };
  }

  function report(r) {
    const lines = [
      `Saved ${r.filename}`,
      `${r.count} entries, ${r.speakers} speakers, ${fmt(r.first)}–${fmt(r.last)}`,
    ];
    if (r.gaps.length) {
      lines.push('', `Gaps longer than ${GAP_WARN_SECONDS} s (check whether something is missing):`);
      for (const g of r.gaps.slice(0, 10)) lines.push(`  ${fmt(g.from)} → ${fmt(g.to)}`);
      if (r.gaps.length > 10) lines.push(`  … and ${r.gaps.length - 10} more`);
    } else {
      lines.push(`No gaps longer than ${GAP_WARN_SECONDS} s.`);
    }
    return lines.join('\n');
  }

  function installButton() {
    if (document.getElementById('tmt-export-button')) return;
    const btn = document.createElement('button');
    btn.id = 'tmt-export-button';
    btn.textContent = 'Export transcript';
    Object.assign(btn.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: 2147483647,
      padding: '8px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
      background: '#5b5fc7', color: '#fff', font: '600 13px system-ui, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,.3)', display: 'none',
    });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await exportTranscript(n => { btn.textContent = `Collecting… ${n}`; });
        console.log('[transcript export]\n' + report(r));
        alert(report(r));
      } catch (e) {
        console.error('[transcript export]', e);
        alert(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Export transcript';
      }
    });
    document.body.appendChild(btn);
    // Show the button only while a transcript panel is present in this frame.
    setInterval(() => {
      if (btn.disabled || document.visibilityState !== 'visible') return;
      btn.style.display = findPanel() ? 'block' : 'none';
    }, 3000);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseHeader, toSeconds, ingest, newState, sortedEntries, findGaps, toMarkdown, fmt };
  } else if (typeof document !== 'undefined') {
    window.exportTeamsTranscript = () => exportTranscript().then(r => { console.log(report(r)); return r; });
    if (document.body) installButton();
    else window.addEventListener('DOMContentLoaded', installButton);
  }
})();
