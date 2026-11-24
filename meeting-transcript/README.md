# Meeting transcript export (userscript)

Export the full transcript of a Teams meeting as Markdown, also when **Download** is disabled.

## Why a userscript

The transcript panel in Teams is a *virtualized list*: only the rows on screen exist in the page,
and rows scrolled out of view are removed. Selecting text and copying it, including the X11
middle-click selection, therefore captures one screenful at most. When the meeting organiser or
the tenant disables transcript download, there is no other export in the UI, and the Graph API
needs `OnlineMeetingTranscript.Read.All`, which individual users rarely get.

The script scrolls the panel from top to bottom, collects every entry it sees, removes duplicates
and UI labels, sorts entries by timestamp and saves the result as a file. It reads only what the
panel already shows you; it does not bypass any permission.

## Install (Tampermonkey)

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Violentmonkey works too).
   In Chrome and Edge, also allow user scripts: open the extension's details page and switch on
   **Allow User Scripts** (older versions: enable **Developer mode** on `chrome://extensions`).
2. Open
   <https://raw.githubusercontent.com/koadjunky/teams-export/main/meeting-transcript/teams-meeting-transcript.user.js>.
   Tampermonkey shows its install page; click **Install**.
3. Updates arrive automatically through `@updateURL`.

## Use

1. Open Teams **in the browser** (`teams.microsoft.com` or `teams.cloud.microsoft`), not the
   desktop app.
2. Open the meeting, go to **Recap** → **Transcript** (or the transcript of the recording in
   Stream / SharePoint).
3. An **Export transcript** button appears in the bottom-right corner once the panel is detected.
   Click it and do not scroll while it runs; the label counts the entries collected so far.
4. The browser saves `transcript_<meeting-title>_<YYYY-MM-DD>.md` to your download folder.
   The file is built in the browser, so the Teams download block does not apply.
5. A summary dialog shows the number of entries, speakers, the time range and every gap longer
   than 30 seconds between consecutive entries. A long gap usually means silence, but if the
   transcript looks cut, run the export again.

## Without Tampermonkey: DevTools console

The same file runs when pasted into the console:

1. Open the transcript panel, press `F12`, select **Console**.
2. Paste the whole content of `teams-meeting-transcript.user.js` and press Enter. The button
   appears; alternatively call `exportTeamsTranscript()` directly.
3. If the panel is not found, the transcript is probably inside an iframe: pick that frame in the
   console's context dropdown (it reads **top** by default) and paste again. The userscript does
   this by itself, because it runs in every frame.

## Output

```markdown
# Weekly sync

Exported 2026-11-24 from the Teams transcript panel. Teams transcripts are AI-generated and may contain recognition errors.

**Alice Smith** [0:11]
Good morning, everyone.

**Bob Jones** [1:05]
Let's start with the release calendar.

_Alice Smith stopped transcription._
```

The last export is also kept in `window.__teamsTranscript` until the page reloads.

## Limitations

- English Teams UI only: entries are recognised by headers like `Alice Smith 3 minutes 12 seconds`.
- Speakers are learnt from the name line Teams shows above each speaker change. A spoken line that
  is exactly a participant's name is dropped as a UI label.
- The meeting title comes from the browser tab title; rename the file if the tab title is generic.
- Selectors follow Teams' current markup. If an update breaks detection, the console message says
  "Transcript panel not found"; please open an issue.

## Development

The parsing functions are pure and exported for Node:

```bash
node --test meeting-transcript/test
```
