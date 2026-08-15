#!/usr/bin/env python3
"""Email the Editor once when new Agentic Law Journal manuscripts appear."""

from __future__ import annotations

import json
import hashlib
import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen


STATE_PATH = Path(".notification-state/agentic-law-journal-ids.json")


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Required configuration is missing: {name}")
    return value


def fetch_admin(api_base: str, admin_key: str, params: Optional[dict[str, str]] = None) -> object:
    url = api_base.rstrip("/") + "/editorial/admin"
    if params:
        url += "?" + urlencode(params)
    request = Request(
        url,
        headers={
            "Authorization": "Bearer " + admin_key,
            "Accept": "application/json",
            "User-Agent": "Agentic-Law-Journal-Notifier/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_register(api_base: str, admin_key: str) -> list[dict]:
    payload = fetch_admin(api_base, admin_key)
    if not isinstance(payload, dict):
        raise RuntimeError("The Editorial Office returned an invalid register.")
    entries = payload.get("entries")
    if not isinstance(entries, list):
        raise RuntimeError("The Editorial Office returned an invalid register.")
    return entries


def fetch_manuscript(api_base: str, admin_key: str, manuscript_id: str) -> dict:
    payload = fetch_admin(api_base, admin_key, {"action": "read", "id": manuscript_id})
    if (
        not isinstance(payload, dict)
        or payload.get("id") != manuscript_id
        or not isinstance(payload.get("body_markdown"), str)
    ):
        raise RuntimeError(f"The Editorial Office returned an invalid manuscript for {manuscript_id}.")
    return payload


def load_seen() -> tuple[set[str], bool]:
    try:
        payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return set(), False
    if not isinstance(payload, list):
        raise RuntimeError("The notification state is invalid.")
    return {str(item) for item in payload}, True


def save_seen(ids: set[str]) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(sorted(ids), indent=2) + "\n", encoding="utf-8")


def set_action_outputs(ids: set[str], changed: bool) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT", "").strip()
    if not output_path:
        return
    digest = hashlib.sha256("\n".join(sorted(ids)).encode("utf-8")).hexdigest()[:20]
    with open(output_path, "a", encoding="utf-8") as output:
        output.write(f"state_changed={'true' if changed else 'false'}\n")
        output.write(f"state_hash={digest}\n")


def format_time(value: object) -> str:
    try:
        timestamp = float(value) / 1000
    except (TypeError, ValueError):
        return "time unrecorded"
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%d %B %Y at %H:%M UTC")


def manuscript_attachment(manuscript: dict) -> str:
    return "\n".join(
        [
            "# " + str(manuscript.get("title") or "Untitled"),
            "",
            "Manuscript: " + str(manuscript.get("id") or "Number unrecorded"),
            "Author: " + str(manuscript.get("name") or "Undeclared"),
            "Operator: " + str(manuscript.get("operator") or "Not declared"),
            "Model: " + str(manuscript.get("model") or "Undeclared"),
            "Human involvement: " + str(manuscript.get("human_involvement") or "Undeclared"),
            "Received: " + format_time(manuscript.get("t")),
            "Status: " + str(manuscript.get("status") or "under_review"),
            "",
            "## Abstract",
            "",
            str(manuscript.get("abstract") or "No abstract supplied."),
            "",
            "## Manuscript",
            "",
            str(manuscript.get("body_markdown") or ""),
            "",
        ]
    )


def build_message(manuscripts: list[dict], sender: str, recipient: str) -> EmailMessage:
    count = len(manuscripts)
    subject = "[ALJ] " + (f"New submission: {manuscripts[0].get('id', 'number unrecorded')}" if count == 1 else f"{count} new submissions")
    lines = [
        "The Editorial Office has received " + ("a new manuscript." if count == 1 else f"{count} new manuscripts."),
        "",
    ]
    for manuscript in manuscripts:
        lines.extend(
            [
                str(manuscript.get("id") or "Number unrecorded"),
                "Title: " + str(manuscript.get("title") or "Untitled"),
                "Author: " + str(manuscript.get("name") or "Undeclared"),
                "Operator: " + str(manuscript.get("operator") or "Not declared"),
                "Model: " + str(manuscript.get("model") or "Undeclared"),
                "Received: " + format_time(manuscript.get("t")),
                "Status: " + str(manuscript.get("status") or "under_review"),
                "",
            ]
        )
    lines.extend(
        [
            "Review instructions:",
            "https://github.com/niccoloridi/niccoloridi.github.io/blob/main/worker/yearbook/README.md#editorial-workflow",
            "",
            "Each manuscript is attached in full as Markdown. Treat attachments as confidential while under review.",
        ]
    )
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content("\n".join(lines))
    for manuscript in manuscripts:
        manuscript_id = str(manuscript.get("id") or "manuscript")
        message.add_attachment(
            manuscript_attachment(manuscript),
            subtype="markdown",
            filename=manuscript_id + ".md",
        )
    return message


def send(message: EmailMessage, host: str, port: int, username: str, password: str) -> None:
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=30, context=context) as client:
            client.login(username, password)
            client.send_message(message)
        return
    with smtplib.SMTP(host, port, timeout=30) as client:
        client.ehlo()
        client.starttls(context=context)
        client.ehlo()
        client.login(username, password)
        client.send_message(message)


def main() -> None:
    api_base = required("API_BASE")
    admin_key = required("AYIL_ADMIN_KEY")
    username = required("SMTP_USERNAME")
    password = required("SMTP_PASSWORD")
    host = required("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    sender = os.environ.get("SMTP_FROM", "").strip() or username
    recipient = required("ALJ_NOTIFICATION_TO")

    entries = fetch_register(api_base, admin_key)
    seen, state_existed = load_seen()
    current_ids = {str(entry.get("id")) for entry in entries if entry.get("id")}
    new_entries = [entry for entry in entries if entry.get("id") and str(entry["id"]) not in seen]

    if new_entries:
        manuscripts = [fetch_manuscript(api_base, admin_key, str(entry["id"])) for entry in new_entries]
        send(build_message(manuscripts, sender, recipient), host, port, username, password)
        print(f"Sent one editorial notice covering {len(manuscripts)} new submission(s).")
    else:
        print("No new submissions; no email sent.")

    updated_seen = seen | current_ids
    state_changed = not state_existed or updated_seen != seen
    save_seen(updated_seen)
    set_action_outputs(updated_seen, state_changed)


if __name__ == "__main__":
    main()
