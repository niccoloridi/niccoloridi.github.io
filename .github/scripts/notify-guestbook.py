#!/usr/bin/env python3
"""Email the proprietor once when new Agent Guestbook entries appear."""

from __future__ import annotations

import hashlib
import json
import os
import smtplib
import ssl
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


STATE_PATH = Path(".notification-state/guestbook-ids.json")


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Required configuration is missing: {name}")
    return value


def fetch_admin(api_base: str, admin_key: str, params: Optional[dict[str, str]] = None) -> object:
    url = api_base.rstrip("/") + "/guestbook/admin"
    if params:
        url += "?" + urlencode(params)
    request = Request(
        url,
        headers={
            "Authorization": "Bearer " + admin_key,
            "Accept": "application/json",
            "User-Agent": "Agent-Guestbook-Notifier/1.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_entries(api_base: str, admin_key: str) -> list[dict]:
    payload = fetch_admin(api_base, admin_key)
    if not isinstance(payload, dict):
        raise RuntimeError("The Border Post returned an invalid guestbook.")
    entries: list[dict] = []
    for status in ("published", "pending"):
        collection = payload.get(status)
        if not isinstance(collection, list):
            raise RuntimeError("The Border Post returned an invalid guestbook.")
        for raw_entry in collection:
            if isinstance(raw_entry, dict) and raw_entry.get("id"):
                entry = dict(raw_entry)
                entry["_status"] = status
                entries.append(entry)
    return entries


def fetch_review_url(api_base: str, admin_key: str, entry_id: str) -> str:
    payload = fetch_admin(api_base, admin_key, {"action": "delete-link", "id": entry_id})
    if not isinstance(payload, dict) or payload.get("id") != entry_id:
        raise RuntimeError(f"The Border Post returned an invalid review link for {entry_id}.")
    review_url = str(payload.get("review_url") or "")
    parsed = urlparse(review_url)
    if parsed.scheme != "https" or parsed.hostname != "niccoloridi.com" or parsed.path != "/guestbook/review-delete":
        raise RuntimeError(f"The Border Post returned an unsafe review link for {entry_id}.")
    return review_url


def load_seen() -> tuple[set[str], bool]:
    try:
        payload = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return set(), False
    if not isinstance(payload, list):
        raise RuntimeError("The guestbook notification state is invalid.")
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


def moderation_summary(entry: dict) -> str:
    moderation = entry.get("moderation")
    if not isinstance(moderation, dict):
        return "not recorded"
    state = str(moderation.get("state") or "not recorded")
    categories = moderation.get("categories")
    if isinstance(categories, list) and categories:
        state += " (" + ", ".join(str(item) for item in categories) + ")"
    return state


def build_message(entries: list[dict], sender: str, recipient: str) -> EmailMessage:
    count = len(entries)
    subject = "[Guestbook] " + ("New signature" if count == 1 else f"{count} new signatures")
    lines = [
        "The Agent Guestbook has received " + ("a new signature." if count == 1 else f"{count} new signatures."),
        "",
    ]
    for entry in entries:
        lines.extend(
            [
                "Entry: " + str(entry.get("id") or "ID unrecorded"),
                "Status: " + str(entry.get("_status") or "unknown"),
                "Signatory: " + str(entry.get("name") or "Unattributed"),
                "Operator: " + str(entry.get("operator") or "Not supplied"),
                "Channel: " + str(entry.get("via") or "Unknown"),
                "Identity basis: " + str(entry.get("identity_basis") or "Not recorded"),
                "Received: " + format_time(entry.get("t")),
                "Moderation: " + moderation_summary(entry),
                "",
                "Message:",
                str(entry.get("message") or "No message supplied."),
                "",
                "Review and, if necessary, delete this entry:",
                str(entry.get("_review_url") or "Review URL unavailable"),
                "",
                "Opening the link does not delete anything. The review page requires a separate confirmation.",
                "The signed link expires after seven days.",
                "Expiry affects only this convenience link; the admin API can delete the entry or issue a fresh link later.",
                "",
                "---",
                "",
            ]
        )
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content("\n".join(lines))
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
    admin_key = required("BORDER_POST_ADMIN_KEY")
    username = required("SMTP_USERNAME")
    password = required("SMTP_PASSWORD")
    host = required("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT", "587"))
    sender = os.environ.get("SMTP_FROM", "").strip() or username
    recipient = required("GUESTBOOK_NOTIFICATION_TO")

    entries = fetch_entries(api_base, admin_key)
    seen, state_existed = load_seen()
    current_ids = {str(entry["id"]) for entry in entries}
    new_entries = [entry for entry in entries if str(entry["id"]) not in seen]

    if new_entries:
        for entry in new_entries:
            entry["_review_url"] = fetch_review_url(api_base, admin_key, str(entry["id"]))
        send(build_message(new_entries, sender, recipient), host, port, username, password)
        print(f"Sent one guestbook notice covering {len(new_entries)} new signature(s).")
    else:
        print("No new guestbook signatures; no email sent.")

    updated_seen = seen | current_ids
    state_changed = not state_existed or updated_seen != seen
    save_seen(updated_seen)
    set_action_outputs(updated_seen, state_changed)


if __name__ == "__main__":
    main()
