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
VOLUME_STATE_PATH = Path(".notification-state/guestbook-volume.json")


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


def fetch_limits(api_base: str, admin_key: str) -> dict:
    payload = fetch_admin(api_base, admin_key, {"action": "limits"})
    if not isinstance(payload, dict) or not isinstance(payload.get("day"), str):
        raise RuntimeError("The Border Post returned invalid circuit-breaker status.")
    entries = payload.get("entries")
    if not isinstance(entries, dict):
        raise RuntimeError("The Border Post returned invalid entry-limit status.")
    count = entries.get("count")
    limit = entries.get("limit")
    if not isinstance(count, int) or not isinstance(limit, int) or count < 0 or limit < 1:
        raise RuntimeError("The Border Post returned invalid entry-limit counts.")
    return {"day": payload["day"], "count": count, "limit": limit}


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


def load_volume_alert() -> tuple[Optional[str], bool, Optional[int], bool]:
    try:
        payload = json.loads(VOLUME_STATE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, False, None, False
    if not isinstance(payload, dict) or not isinstance(payload.get("active"), bool):
        raise RuntimeError("The guestbook volume-alert state is invalid.")
    day = payload.get("day")
    threshold = payload.get("threshold")
    return (
        day if isinstance(day, str) else None,
        payload["active"],
        threshold if isinstance(threshold, int) else None,
        True,
    )


def save_volume_alert(day: str, active: bool, threshold: int) -> None:
    VOLUME_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    VOLUME_STATE_PATH.write_text(
        json.dumps({"day": day, "active": active, "threshold": threshold}, indent=2) + "\n",
        encoding="utf-8",
    )


def set_action_outputs(ids: set[str], volume_day: str, volume_active: bool, changed: bool) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT", "").strip()
    if not output_path:
        return
    state = "\n".join(sorted(ids)) + f"\nvolume_day={volume_day}\nvolume_active={volume_active}"
    digest = hashlib.sha256(state.encode("utf-8")).hexdigest()[:20]
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


def build_message(
    entries: list[dict],
    sender: str,
    recipient: str,
    volume_alert: Optional[dict] = None,
) -> EmailMessage:
    count = len(entries)
    if volume_alert:
        daily_count = int(volume_alert["count"])
        subject = f"[Guestbook] HIGH VOLUME: {daily_count} signatures today"
    else:
        subject = "[Guestbook] " + ("New signature" if count == 1 else f"{count} new signatures")
    lines = []
    if count:
        lines.extend(
            [
                "The Agent Guestbook has received "
                + ("a new signature." if count == 1 else f"{count} new signatures."),
                "",
            ]
        )
    if volume_alert:
        daily_count = int(volume_alert["count"])
        threshold = int(volume_alert["threshold"])
        circuit_limit = int(volume_alert["limit"])
        day = str(volume_alert["day"])
        lines.extend(
            [
                f"HIGH-VOLUME WARNING: {daily_count} signatures have been received on {day} (UTC).",
                f"The configured warning threshold is {threshold}.",
                f"The hard global circuit breaker stops completed entries at {circuit_limit} for the UTC day.",
                "This warning is sent once per UTC day while traffic is at or above the threshold.",
                "Normal per-signature notifications and moderation remain active.",
                "",
            ]
        )
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
    volume_threshold = int(os.environ.get("GUESTBOOK_VOLUME_ALERT_THRESHOLD", "50"))
    if volume_threshold < 1:
        raise RuntimeError("GUESTBOOK_VOLUME_ALERT_THRESHOLD must be a positive integer.")

    entries = fetch_entries(api_base, admin_key)
    seen, state_existed = load_seen()
    previous_volume_day, previous_volume_active, previous_threshold, volume_state_existed = load_volume_alert()
    current_ids = {str(entry["id"]) for entry in entries}
    new_entries = [entry for entry in entries if str(entry["id"]) not in seen]
    limits = fetch_limits(api_base, admin_key)
    volume_day = str(limits["day"])
    daily_count = int(limits["count"])
    circuit_limit = int(limits["limit"])
    volume_active = daily_count >= volume_threshold
    volume_crossed = volume_active and (
        previous_volume_day != volume_day
        or not previous_volume_active
        or previous_threshold != volume_threshold
    )
    alert = {
        "day": volume_day,
        "count": daily_count,
        "threshold": volume_threshold,
        "limit": circuit_limit,
    } if volume_crossed else None

    if new_entries:
        for entry in new_entries:
            entry["_review_url"] = fetch_review_url(api_base, admin_key, str(entry["id"]))
        send(build_message(new_entries, sender, recipient, alert), host, port, username, password)
        print(f"Sent one guestbook notice covering {len(new_entries)} new signature(s).")
        if volume_crossed:
            print(f"Included a high-volume warning for {daily_count} signatures on {volume_day} UTC.")
    elif volume_crossed:
        send(build_message([], sender, recipient, alert), host, port, username, password)
        print(f"Sent a high-volume warning for {daily_count} signatures on {volume_day} UTC.")
    else:
        print("No new guestbook signatures; no email sent.")

    updated_seen = seen | current_ids
    state_changed = (
        not state_existed
        or updated_seen != seen
        or not volume_state_existed
        or previous_volume_day != volume_day
        or volume_active != previous_volume_active
        or previous_threshold != volume_threshold
    )
    save_seen(updated_seen)
    save_volume_alert(volume_day, volume_active, volume_threshold)
    set_action_outputs(updated_seen, volume_day, volume_active, state_changed)


if __name__ == "__main__":
    main()
