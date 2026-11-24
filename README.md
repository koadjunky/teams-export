# teams-export

Get your own Microsoft Teams content out of Teams, in two independent ways:

| What you want | Tool | How it works | Needs |
|---|---|---|---|
| **Chat and channel messages** (1:1 chats, group chats, channels) | [`graph/`](graph/) | Python script calling the Microsoft Graph API | A Graph token with chat/channel read scopes |
| **Meeting transcripts** | [`meeting-transcript/`](meeting-transcript/) | Userscript that reads the transcript panel in the browser | A browser and Tampermonkey (or the DevTools console) |

The two tools share nothing: use whichever matches what you need.

Why two? Graph is the clean way to read messages, but meeting transcripts need
`OnlineMeetingTranscript.Read.All`, which most tenants do not grant to individual users. And when the
meeting organiser or the tenant disables transcript download, the Teams UI offers no export at all.
The transcript panel still shows everything you are allowed to read, so the userscript collects it
from there.

## Chat and channel messages: `graph/`

See [graph/README.md](graph/README.md).

```bash
cd graph
pip install msal requests
python3 export_teams.py              # prompts for a contact, chat topic or channel name
python3 transcript.py teams_export_*.json
```

## Meeting transcripts: `meeting-transcript/`

See [meeting-transcript/README.md](meeting-transcript/README.md).

Install the userscript in Tampermonkey from
<https://raw.githubusercontent.com/koadjunky/teams-export/main/meeting-transcript/teams-meeting-transcript.user.js>,
open a meeting's transcript in Teams on the web and click **Export transcript**.

## License

Apache-2.0, see [LICENSE](LICENSE).
