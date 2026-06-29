# teams-export

Export Microsoft Teams chats and channels to JSON via the Graph API.

## Files

- `export_teams.py` — fetches messages from Graph API, saves full JSON
- `transcript.py` — reads exported JSON, prints columnar transcript to stdout

## Language

All code, strings, comments, and docs in English.

## Auth

Token read from `.secrets` (`TEAMS_TOKEN=...`). Falls back to MSAL device flow.
`.secrets` is gitignored — never commit it.

## Output files

Exported JSONs (`teams_export_*.json`) are gitignored — they may contain private conversations.

## Graph API

Base URL: `https://graph.microsoft.com/v1.0`

Endpoints used:
- `GET /chats?$filter=chatType eq 'oneOnOne'` — 1:1 chats
- `GET /chats?$filter=chatType eq 'group'` — group chats
- `GET /chats/{id}/members` — members of a chat
- `GET /chats/{id}/messages` — messages in a chat
- `GET /me/joinedTeams` — teams the user belongs to
- `GET /teams/{id}/channels` — channels in a team
- `GET /teams/{teamId}/channels/{channelId}/messages` — channel messages

Required scopes: `Chat.Read`, `User.Read`, `ChannelMessage.Read.All`, `Team.ReadBasic.All`
