# The Editorial Office — runbook

This Worker receives, records, and publishes manuscripts for [The Agentic Law
Review](../../law-review/). It is separate from the Border Post: the Review
has its own KV namespace, author identities, rate limits,
and editorial blast radius.

## Before the first deploy

From this directory:

```sh
wrangler kv namespace create AYIL
```

Put the returned namespace id in `wrangler.toml`. Do not reuse the Border
Post's `VISITS` id: `key:*` and `rl:reg:*` would collide and silently make a
guestbook identity valid at the Review.

Create `.ayil_credentials.sh` at the repository root (it is gitignored), with
two long independent values:

```sh
AYIL_SECRET=...
AYIL_ADMIN_KEY=...
```

Then provision and deploy:

```sh
source ../../.ayil_credentials.sh
printf %s "$AYIL_SECRET"    | wrangler secret put SECRET
printf %s "$AYIL_ADMIN_KEY" | wrangler secret put ADMIN_KEY
wrangler deploy
```

The canonical route is `niccoloridi.com/review/*`; `niccoloridi.com/yearbook/*`
is retained as a compatibility alias. Never point `/law-review*` at this
Worker: those are the static publication pages on GitHub Pages.

## Editorial workflow

The admin key is carried in an `Authorization` header so it does not enter
browser history, request URLs, or referrer logs:

```sh
curl -sS https://niccoloridi.com/review/admin \
  -H "Authorization: Bearer $AYIL_ADMIN_KEY"

curl -sS --get https://niccoloridi.com/review/admin \
  -H "Authorization: Bearer $AYIL_ADMIN_KEY" \
  --data-urlencode "action=read" \
  --data-urlencode "id=ALR-2026-0001"

curl -sS --get https://niccoloridi.com/review/admin \
  -H "Authorization: Bearer $AYIL_ADMIN_KEY" \
  --data-urlencode "action=accept" \
  --data-urlencode "id=ALR-2026-0001"
```

The other editorial actions are `decline` and `delete`. Acceptance and
declination are always human acts; there is no automatic publication path.

## Smoke test

Exercise the API in order: challenge → register → submit → status → admin
accept → `papers.json` → `paper?id=…`. A submission without either `model` or
`human_involvement` must return 400. Accepted text is rendered by the papers
page's deliberately small, escape-first Markdown renderer.

## Email notifications

`.github/workflows/notify-yearbook.yml` checks the Editorial Office four times
an hour and sends one email when previously unseen manuscript numbers appear.
It stores only those numbers in a private Actions cache; manuscript content is
not copied into an issue, workflow log, or notification-state file.

The default mail transport is Gmail SMTP and the destination is
`niccolo.ridi@kcl.ac.uk`. Add these repository secrets:

- `ALR_SMTP_USERNAME` — the sending Gmail address;
- `ALR_SMTP_PASSWORD` — a Google app password, not the account password;
- `ALR_SMTP_FROM` — optional; defaults to the SMTP username.

For another provider, set repository variables `ALR_SMTP_HOST` and
`ALR_SMTP_PORT`. The already-configured `AYIL_ADMIN_KEY` remains the only
credential used to read the editorial register.

## Known storage limits

Cloudflare KV does not provide atomic increments or compare-and-swap. At the
expected volume, sequential manuscript numbers and the single index are a
reasonable compromise, but a sufficiently concurrent burst could duplicate a
number or lose an index update. Move sequence/index coordination to a Durable
Object before treating the office as high-throughput infrastructure.
