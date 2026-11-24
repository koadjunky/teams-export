# teams-export

Two independent ways to get Teams content out. They share no code; keep them separate.

| Directory | What | How |
|---|---|---|
| `graph/` | Chat and channel messages | Python + Microsoft Graph API |
| `meeting-transcript/` | Meeting transcripts | Userscript (Tampermonkey) / DevTools console, reads the transcript panel |

Public repository: no real company, client or colleague names anywhere, including test fixtures
(use Alice Smith, Bob Jones, …).

## Language

All code, strings, comments, and docs in English.

## graph/

- `export_teams.py` — fetches messages from Graph API, saves full JSON to the current directory
- `transcript.py` — reads an exported JSON, prints a columnar chat log to stdout

Token read from `graph/.secrets` (`TEAMS_TOKEN=...`, path is relative to the script). Falls back to
MSAL device flow. `.secrets` and exported `teams_export_*.json` are gitignored — they may contain
private conversations.

Graph endpoints used (base `https://graph.microsoft.com/v1.0`):
- `GET /chats?$filter=chatType eq 'oneOnOne'` — 1:1 chats
- `GET /chats?$filter=chatType eq 'group'` — group chats
- `GET /chats/{id}/members` — members of a chat
- `GET /chats/{id}/messages` — messages in a chat
- `GET /me/joinedTeams` — teams the user belongs to
- `GET /teams/{id}/channels` — channels in a team
- `GET /teams/{teamId}/channels/{channelId}/messages` — channel messages

Required scopes: `Chat.Read`, `User.Read`, `ChannelMessage.Read.All`, `Team.ReadBasic.All`.
Meeting transcripts would need `OnlineMeetingTranscript.Read.All` (admin consent), which is why
`meeting-transcript/` exists.

## meeting-transcript/

- `teams-meeting-transcript.user.js` — one file that is both the Tampermonkey userscript and the
  console paste. Pure parsing functions are exported through `module.exports` when loaded by
  Node; the browser part runs only when `document` exists.
- `test/parse.test.js` — `node --test meeting-transcript/test` (Node 18+, no dependencies).

Facts the parser relies on (English UI):
- Panel `innerText` per entry: avatar initials (`AS`), bare name, bare duration
  (`0 minutes 11 seconds`), clock (`0:11`), empty line, then the header
  `Alice Smith 0 minutes 11 seconds` and the spoken text. Continuation entries of the same
  speaker have only the header. Durations may omit parts: `1 minute`, `31 minutes`,
  `1 hour 2 minutes 3 seconds`.
- Speakers are learnt from "line followed by a bare duration"; a header is accepted only for a
  known speaker, so "Give me 5 minutes" stays text.
- Renders can arrive out of order; entries are keyed by speaker + seconds and sorted at the end.
- DevTools `copy()` is unavailable after an `await`, so the file is saved through a Blob link.

Bump `@version` in the userscript header on every change, or Tampermonkey will not update.
