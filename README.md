# teams-export

Export Microsoft Teams chats and channel history to JSON via the Graph API.

Supports: 1:1 chats (by contact name/email), group chats (by topic), and channels (by team or channel name).

## Requirements

```bash
pip install msal requests
```

## Authentication

The script uses MSAL device flow. If your tenant blocks the Graph Explorer client ID, get a token manually instead.

### Getting a token from Graph Explorer

1. Open [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer) and sign in
2. Grant the required permissions (see below)
3. Left panel → **Access token** tab → copy the full token value
4. Create `.secrets` next to the script:

```
TEAMS_TOKEN=eyJ0eXAi...
```

Token is valid for ~1 hour. When it expires, repeat steps 3–4.

### Required permissions

In Graph Explorer, open the **Modify permissions** tab and consent to:

| Permission | Section in "Modify permissions" | Reason |
|---|---|---|
| `User.Read` | **Users** | Basic profile / sign-in |
| `Chat.Read` | **Microsoft Teams (beta)** | Read 1:1 and group chats |
| `ChannelMessage.Read.All` | **Microsoft Teams (beta)** | Read channel messages |
| `Team.ReadBasic.All` | **Users** | List joined teams and channels |

After consenting, sign out and sign back in to Graph Explorer so the new token includes all scopes.

## Usage

```bash
python3 export_teams.py
```

Enter a search term when prompted. The script searches in order:

1. **1:1 chats** — by contact display name or email
2. **Group chats** — by chat topic
3. **Channels** — by team name or channel name

First match wins. Output is saved to `teams_export_YYYYMMDD_HHMMSS.json`.

## Output format

Full Graph API payload, nothing stripped:

```json
{
  "exportedAt": "2024-03-15T09:45:00Z",
  "type": "chat",
  "label": "Alice Smith",
  "chatId": "19:abc123...@unq.gbl.spaces",
  "messageCount": 342,
  "messages": [
    {
      "id": "1710492131000",
      "createdDateTime": "2024-03-15T09:42:11Z",
      "lastModifiedDateTime": "2024-03-15T09:42:11Z",
      "messageType": "message",
      "from": {
        "user": {
          "displayName": "Alice Smith",
          "id": "...",
          "userIdentityType": "aadUser"
        }
      },
      "body": {
        "contentType": "html",
        "content": "<p>Good morning</p>"
      },
      "attachments": [],
      "reactions": [],
      "mentions": []
    }
  ]
}
```

For channels, `type` is `"channel"` and the payload includes `teamId` and `channelId` instead of `chatId`.

All Graph API fields are preserved: reactions, attachments, mentions, edit history, importance flags, etc.

## Transcript

Extract a readable transcript from an exported JSON:

```bash
python3 transcript.py teams_export_20240315_094500.json
```

Output (stdout):

```
2024-03-15 09:42:11  Alice Smith  Good morning
2024-03-15 09:43:05  Bob Jones    Morning! Ready for the call?
```

Pipe to a file or `grep` as needed:

```bash
python3 transcript.py export.json > transcript.txt
python3 transcript.py export.json | grep "Alice"
```

## Notes

- `.secrets` and exported `.json` files are gitignored
- If MSAL device flow works in your tenant, `.secrets` is optional — the script falls back to device flow automatically
