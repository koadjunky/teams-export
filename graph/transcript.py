#!/usr/bin/env python3
# python3 transcript.py teams_export_*.json

import json, re, sys
from pathlib import Path

def strip_html(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()

def unescape(text):
    return (text
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&quot;", '"')
        .replace("&#39;", "'"))

path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not path or not path.exists():
    print(f"Usage: python3 {sys.argv[0]} <export.json>")
    sys.exit(1)

data = json.loads(path.read_text(encoding="utf-8"))
messages = data.get("messages", [])

COL_TS = 20
COL_AU = 20
INDENT = " " * (COL_TS + COL_AU)

for msg in messages:
    if msg.get("messageType") != "message":
        continue
    author = (msg.get("from") or {}).get("user", {}).get("displayName") or "?"
    timestamp = msg.get("createdDateTime", "")[:19].replace("T", " ")
    body = unescape(strip_html(msg.get("body", {}).get("content", ""))).strip()
    if not body:
        continue
    lines = body.splitlines()
    first = f"{timestamp:<{COL_TS}}{author:<{COL_AU}}{lines[0]}"
    rest = [f"{INDENT}{line}" for line in lines[1:]]
    print("\n".join([first] + rest))
