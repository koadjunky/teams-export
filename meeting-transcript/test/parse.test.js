// Run: node --test meeting-transcript/test
const test = require('node:test');
const assert = require('node:assert');
const t = require('../teams-meeting-transcript.user.js');

// innerText of the panel as Teams renders it: avatar initials, bare name, bare duration,
// clock, an empty line, then the accessible header and the spoken text.
const RENDER_TOP = `
AS
Alice Smith
0 minutes 11 seconds
0:11

Alice Smith 0 minutes 11 seconds
Good morning, everyone.
Bob Jones
1 minute
1:00

Bob Jones 1 minute
OK
Bob Jones 1 minute 5 seconds
Let's start with the release calendar.
Give me 5 minutes
`;

// A later render, overlapping the first one (Bob's 1:05 entry is seen again).
const RENDER_BOTTOM = `
Bob Jones 1 minute 5 seconds
Let's start with the release calendar.
AS
Alice Smith
1 hour 2 minutes 3 seconds
1:02:03

Alice Smith 1 hour 2 minutes 3 seconds
Thanks, bye.

Alice Smith
stopped transcription
`;

test('bare durations are not headers', () => {
  assert.strictEqual(t.parseHeader('0 minutes 11 seconds'), null);
  assert.strictEqual(t.parseHeader('1 minute 27 seconds'), null);
  assert.deepStrictEqual(t.parseHeader('Alice Smith 0 minutes 11 seconds'), { speaker: 'Alice Smith', seconds: 11 });
  assert.deepStrictEqual(t.parseHeader('Bob Jones 1 minute'), { speaker: 'Bob Jones', seconds: 60 });
  assert.deepStrictEqual(t.parseHeader('Bob Jones 31 minutes'), { speaker: 'Bob Jones', seconds: 1860 });
  assert.deepStrictEqual(t.parseHeader('Alice Smith 1 hour 2 minutes 3 seconds'), { speaker: 'Alice Smith', seconds: 3723 });
});

test('renders are merged, deduplicated, sorted and stripped of UI noise', () => {
  const s = t.newState();
  t.ingest(s, RENDER_BOTTOM);   // out of order on purpose: the panel can render the end first
  t.ingest(s, RENDER_TOP);
  const entries = t.sortedEntries(s);
  assert.deepStrictEqual(entries.map(e => [e.speaker, e.seconds, e.lines]), [
    ['Alice Smith', 11, ['Good morning, everyone.']],
    ['Bob Jones', 60, ['OK']],
    ['Bob Jones', 65, ["Let's start with the release calendar.", 'Give me 5 minutes']],
    ['Alice Smith', 3723, ['Thanks, bye.']],
  ]);
  const md = t.toMarkdown(s, 'Weekly sync', '2026-01-01');
  assert.match(md, /^# Weekly sync/);
  assert.match(md, /\*\*Alice Smith\*\* \[1:02:03\]\nThanks, bye\./);
  assert.match(md, /_Alice Smith stopped transcription\._\s*$/);
  assert.doesNotMatch(md, /^AS$/m);
});

test('gaps are reported', () => {
  const s = t.newState();
  t.ingest(s, RENDER_TOP + RENDER_BOTTOM);
  assert.deepStrictEqual(t.findGaps(t.sortedEntries(s)), [{ from: 11, to: 60 }, { from: 65, to: 3723 }]);
});
