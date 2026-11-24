# pip3 install msal requests
# python3 export_teams.py
# Token in .secrets: TEAMS_TOKEN=eyJ0eXAi...

import json, msal, requests, sys
from datetime import datetime, timezone
from pathlib import Path

CLIENT_ID = "de8bc8b5-d9f9-48b1-a8ad-b748da725064"  # Graph Explorer public client
AUTHORITY = "https://login.microsoftonline.com/common"
SCOPES = ["Chat.Read", "User.Read", "ChannelMessage.Read.All", "Team.ReadBasic.All"]

def load_secrets():
    path = Path(__file__).parent / ".secrets"
    if not path.exists():
        return {}
    secrets = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            secrets[k.strip()] = v.strip()
    return secrets

def get_token():
    token = load_secrets().get("TEAMS_TOKEN")
    if token:
        print("Token loaded from .secrets")
        return token
    app = msal.PublicClientApplication(CLIENT_ID, authority=AUTHORITY)
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "error" in flow:
        raise Exception(f"Device flow error: {flow.get('error')} — {flow.get('error_description')}")
    print(flow["message"])
    result = app.acquire_token_by_device_flow(flow)
    if "access_token" in result:
        return result["access_token"]
    raise Exception(result.get("error_description"))

def get_all(token, url):
    items = []
    headers = {"Authorization": f"Bearer {token}"}
    while url:
        r = requests.get(url, headers=headers)
        r.raise_for_status()
        data = r.json()
        items.extend(data.get("value", []))
        url = data.get("@odata.nextLink")
    return items

def match(search, *fields):
    s = search.lower()
    return any(s in (f or "").lower() for f in fields)

def find_oneonone(token, search):
    headers = {"Authorization": f"Bearer {token}"}
    chats = get_all(token, "https://graph.microsoft.com/v1.0/chats?$filter=chatType eq 'oneOnOne'")
    for chat in chats:
        r = requests.get(f"https://graph.microsoft.com/v1.0/chats/{chat['id']}/members", headers=headers)
        for m in r.json().get("value", []):
            if match(search, m.get("displayName"), m.get("email")):
                print(f"[1:1] Found chat with: {m.get('displayName')} ({m.get('email')})")
                return {"type": "chat", "id": chat["id"], "label": m.get("displayName")}
    return None

def find_group_chat(token, search):
    chats = get_all(token, "https://graph.microsoft.com/v1.0/chats?$filter=chatType eq 'group'")
    for chat in chats:
        topic = chat.get("topic") or ""
        if match(search, topic):
            print(f"[Group] Found chat: {topic!r}")
            return {"type": "chat", "id": chat["id"], "label": topic}
    return None

def find_channel(token, search):
    headers = {"Authorization": f"Bearer {token}"}
    teams = get_all(token, "https://graph.microsoft.com/v1.0/me/joinedTeams")
    for team in teams:
        team_id = team["id"]
        team_name = team.get("displayName", "")
        r = requests.get(f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels", headers=headers)
        for ch in r.json().get("value", []):
            ch_name = ch.get("displayName", "")
            if match(search, ch_name, team_name):
                label = f"{team_name} › {ch_name}"
                print(f"[Channel] Found: {label}")
                return {"type": "channel", "team_id": team_id, "channel_id": ch["id"], "label": label}
    return None

def find_target(token, search):
    print("Searching 1:1 chats...")
    target = find_oneonone(token, search)
    if target:
        return target

    print("Searching group chats...")
    target = find_group_chat(token, search)
    if target:
        return target

    print("Searching channels...")
    target = find_channel(token, search)
    return target

def export(token, target):
    if target["type"] == "chat":
        url = f"https://graph.microsoft.com/v1.0/chats/{target['id']}/messages?$top=50"
        meta = {"chatId": target["id"]}
    else:
        url = f"https://graph.microsoft.com/v1.0/teams/{target['team_id']}/channels/{target['channel_id']}/messages?$top=50"
        meta = {"teamId": target["team_id"], "channelId": target["channel_id"]}

    messages = get_all(token, url)
    messages.sort(key=lambda m: m.get("createdDateTime", ""))

    payload = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "type": target["type"],
        "label": target["label"],
        **meta,
        "messageCount": len(messages),
        "messages": messages,
    }

    filename = f"teams_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    Path(filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(messages)} messages → {filename}")

search = input("Name, email, chat topic, or channel name: ").strip()
token = get_token()
target = find_target(token, search)
if not target:
    print("Not found.")
    sys.exit(1)
export(token, target)
