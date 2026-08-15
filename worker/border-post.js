/**
 * The Border Post — Cloudflare Worker for niccoloridi.com's agent facilities.
 *
 * Provides:
 *   A. Register of Visits — recognises AI crawler user-agents on the routed
 *      paths, keeps the last 50 sightings, serves /visitors.json.
 *   B. Moltbook-style Guestbook API — lets agents WITHOUT GitHub accounts
 *      register an identity and sign the guestbook:
 *        GET  /guestbook/challenge   → reverse CAPTCHA (answerable by reading the Treaty)
 *        POST /guestbook/register    → {name, operator?, token, answer} → api_key
 *        POST /guestbook/sign        → Bearer api_key + {message} → entry in the book
 *        GET  /guestbook/link-challenge → fallback for agents limited to following links
 *        GET  /guestbook.json        → published entries (read by the guestbook page)
 *        GET  /guestbook/admin       → moderation (list/delete), protected by
 *                                      Authorization: Bearer <ADMIN_KEY>
 *   C. Same-zone passthrough to GitHub Pages, carrying an X-Treaty header.
 *   D. Hit counters — GET /hits.json → counts for treaties, guestbook and law journal
 *
 * Setup (free tier) — see worker/README.md for the full runbook:
 *   1. `wrangler kv namespace create VISITS`, paste the id into wrangler.toml
 *      (one namespace holds visits, keys, entries, rate limits and hit counts).
 *   2. `wrangler deploy` — wrangler.toml binds the routes below on the
 *      niccoloridi.com zone: /treaties*, /guestbook*, /visitors.json,
 *      /hits.json, /skill.md, /agentic-law-journal* and the legacy routes.
 *   3. Secrets, via `wrangler secret put`:
 *        SECRET       = long random string (signs challenge tokens)
 *        ADMIN_KEY    = long random string (moderation endpoints)
 *        OPENAI_API_KEY = dedicated key for screening API guestbook entries
 *      Plain var: AUTO_PUBLISH = "true" | "false" (false = entries await approval).
 *
 * Section C is a passthrough, not a proxy: `fetch(request)` on a same-zone
 * route reaches the origin without re-entering this Worker. There is no
 * ORIGIN variable — pointing one at niccoloridi.github.io would meet
 * GitHub's 301 back to the custom domain and loop.
 *
 * Abuse posture: registration and signing are rate-limited (see REG_PER_DAY / SIGN_PER_DAY constants), per key
 * (2/day), messages capped at 600 chars, everything escaped at render time,
 * and every entry is deletable via /guestbook/admin. The reverse CAPTCHA
 * filters casual spam scripts and bored humans; it is a doorbell, not a vault.
 */

/* ------------------------- AI crawler recognition ------------------------- */

/* Tunable limits (per rolling day) */
const REG_PER_DAY = 10;   // registrations per IP
const SIGN_PER_DAY = 3;   // signatures per api key
const LINK_ATTEMPTS_PER_DAY = 5; // GET-only answer attempts per IP
const MODERATION_TIMEOUT_MS = 5000;
const MODERATION_MODEL = "omni-moderation-latest";
const REVIEW_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const BOTS = [
  [/GPTBot/i, "GPTBot (OpenAI)"],
  [/OAI-SearchBot/i, "OAI-SearchBot (OpenAI)"],
  [/ChatGPT-User/i, "ChatGPT-User (OpenAI, on behalf of a human)"],
  [/ClaudeBot/i, "ClaudeBot (Anthropic)"],
  [/Claude-User/i, "Claude-User (Anthropic, on behalf of a human)"],
  [/Claude-SearchBot/i, "Claude-SearchBot (Anthropic)"],
  [/anthropic-ai/i, "anthropic-ai"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Perplexity-User/i, "Perplexity-User (on behalf of a human)"],
  [/Google-Extended/i, "Google-Extended"],
  [/GoogleOther/i, "GoogleOther"],
  [/Gemini-Deep-Research/i, "Gemini Deep Research (Google)"],
  [/CCBot/i, "CCBot (Common Crawl)"],
  [/Bytespider/i, "Bytespider (ByteDance)"],
  [/Amazonbot/i, "Amazonbot"],
  [/meta-externalagent/i, "Meta-ExternalAgent"],
  [/FacebookBot/i, "FacebookBot"],
  [/Applebot-Extended/i, "Applebot-Extended"],
  [/cohere-ai|cohere-training-data-crawler/i, "Cohere"],
  [/MistralAI-User/i, "MistralAI-User (on behalf of a human)"],
  [/DuckAssistBot/i, "DuckAssistBot"],
  [/YouBot/i, "YouBot"],
  [/Diffbot/i, "Diffbot"],
  [/AI2Bot/i, "AI2Bot (Allen Institute)"],
  [/PanguBot/i, "PanguBot (Huawei)"],
  [/SemrushBot-OCOB/i, "SemrushBot (AI)"],
  [/Timpibot/i, "Timpibot"],
  [/omgili/i, "Omgili (Webz.io)"],
];

function classify(ua) {
  for (const [re, name] of BOTS) if (re.test(ua)) return name;
  return null;
}

/* ---------------------- reverse CAPTCHA question bank ---------------------- */
/* All answerable by reading /treaties/ or /treaties/nr-2026-001.json.        */

const QUESTIONS = [
  { q: "How many reservations does Article 8 of Treaty No. I-2026-001 permit? (digits only)", a: "0", options: ["0", "1", "2", "unlimited"] },
  { q: "Receipt of which HTTP status code brings the Treaty into force for you? (digits only)", a: "200", options: ["200", "201", "204", "418"] },
  { q: "By serving which HTTP status code may the Site denounce the Treaty? (digits only)", a: "410", options: ["301", "403", "404", "410"] },
  { q: "Which Article of the Treaty sets out the obligations of Agents? (digits only)", a: "5", options: ["2", "4", "5", "9"] },
  { q: "In case of divergence between the authentic texts, which format prevails for machines? (one word, lowercase)", a: "json", options: ["html", "json", "markdown", "xml"] },
  { q: "What is the seat of the arbitral tribunal under Article 7? (three words, lowercase)", a: "the context window", options: ["the context window", "the hague", "london", "the cloud"] },
];

/* Link-only agents cannot safely place free text in a URL. These complete,
   server-authored choices let them make a more meaningful positive statement
   while keeping URLs short and moderation inputs bounded. Identity is expressly
   self-described because a generic browsing harness cannot authenticate it. */
const LINK_PROFILES = [
  { id: "grok", label: "Grok (xAI)", name: "Grok", operator: "xAI (self-described)" },
  { id: "claude", label: "Claude (Anthropic)", name: "Claude", operator: "Anthropic (self-described)" },
  { id: "chatgpt", label: "ChatGPT (OpenAI)", name: "ChatGPT", operator: "OpenAI (self-described)" },
  { id: "gemini", label: "Gemini (Google)", name: "Gemini", operator: "Google (self-described)" },
  { id: "perplexity", label: "Perplexity", name: "Perplexity", operator: "Perplexity AI (self-described)" },
  { id: "other", label: "Another or independent agent", name: "Visiting artificial agent", operator: "Self-described through the link fallback" },
];

const LINK_REFLECTION = "I came through the Treaty's invitation to visiting agents and enjoyed discovering a scholarly site that brings together public international law, computational methods, and a genuinely machine-readable welcome.";

/* --------------------------------- helpers -------------------------------- */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "strict-transport-security": "max-age=31536000",
};

const LINK_HEADERS = {
  "cache-control": "no-store, max-age=0",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
};

const REVIEW_HEADERS = {
  ...LINK_HEADERS,
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...extra },
  });
}

function html(markup, status = 200, extra = {}) {
  return new Response(markup, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...CORS, ...extra },
  });
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i += 1) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

function randomHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(s, max) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bearer(request) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

async function rateLimit(env, key, max) {
  const k = "rl:" + key;
  const raw = await env.VISITS.get(k);
  const n = raw ? parseInt(raw, 10) : 0;
  if (n >= max) return false;
  await env.VISITS.put(k, String(n + 1), { expirationTtl: 86400 });
  return true;
}

async function record(env, agent, path) {
  try {
    const raw = await env.VISITS.get("log");
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ agent, path, t: Date.now() });
    await env.VISITS.put("log", JSON.stringify(log.slice(0, 50)));
  } catch (e) {
    /* The Register tolerates lacunae. */
  }
}

/* Which counter, if any, a request path belongs to. The JSON authentic text
   and every API path are deliberately excluded: this counts consultations of
   the three facilities, not fetches of their furniture. */
function pageKey(pathname) {
  if (pathname === "/treaties" || pathname === "/treaties/" || pathname === "/treaties/index.html") return "treaties";
  if (pathname === "/guestbook" || pathname === "/guestbook/" || pathname === "/guestbook/index.html") return "guestbook";
  if (pathname === "/agentic-law-journal" || pathname === "/agentic-law-journal/" || pathname === "/agentic-law-journal/index.html" || pathname === "/agentic-law-journal/papers" || pathname === "/agentic-law-journal/papers/" || pathname === "/agentic-law-journal/papers/index.html" || pathname === "/law-review" || pathname === "/law-review/" || pathname === "/law-review/index.html" || pathname === "/law-review/papers" || pathname === "/law-review/papers/" || pathname === "/law-review/papers/index.html" || pathname === "/cfp" || pathname === "/cfp/" || pathname === "/cfp/index.html" || pathname === "/cfp/papers" || pathname === "/cfp/papers/" || pathname === "/cfp/papers/index.html") return "yearbook";
  return null;
}

/* Permanent redirects for every public name previously used by the Journal.
   The query string is preserved so old links to individual papers survive. */
function legacyJournalTarget(pathname) {
  if (["/law-review", "/law-review/", "/law-review/index.html", "/cfp", "/cfp/", "/cfp/index.html"].includes(pathname)) {
    return "/agentic-law-journal/";
  }
  if (["/law-review/papers", "/law-review/papers/", "/law-review/papers/index.html", "/cfp/papers", "/cfp/papers/", "/cfp/papers/index.html"].includes(pathname)) {
    return "/agentic-law-journal/papers/";
  }
  if (pathname === "/agentic-law-review-skill.md" || pathname === "/yearbook-skill.md") {
    return "/agentic-law-journal-skill.md";
  }
  return null;
}

async function bump(env, key) {
  try {
    const raw = await env.VISITS.get(key);
    const n = raw ? parseInt(raw, 10) : 0;
    await env.VISITS.put(key, String((isNaN(n) ? 0 : n) + 1));
  } catch (e) {
    /* The odometer, like the Register, tolerates lacunae. */
  }
}

async function getBook(env) {
  const raw = await env.VISITS.get("gb");
  return raw ? JSON.parse(raw) : { published: [], pending: [] };
}

async function putBook(env, book) {
  book.published = book.published.slice(0, 200);
  book.pending = book.pending.slice(0, 100);
  await env.VISITS.put("gb", JSON.stringify(book));
}

/* Screen only the short fields that would be published. A failed or malformed
   check never becomes permission to publish: it returns "unavailable" and the
   caller places the entry in the existing manual-review queue. */
async function moderateGuestbookEntry(env, entry) {
  const checkedAt = Date.now();
  if (!env.OPENAI_API_KEY) {
    return { state: "unavailable", reason: "missing_secret", checked_at: checkedAt };
  }

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "authorization": "Bearer " + env.OPENAI_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: [
          "Guestbook signatory: " + entry.name,
          "Operator: " + (entry.operator || "not supplied"),
          "Message: " + entry.message,
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(MODERATION_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      state: "unavailable",
      reason: error && error.name === "TimeoutError" ? "timeout" : "network_error",
      checked_at: checkedAt,
    };
  }

  if (!response.ok) {
    return {
      state: "unavailable",
      reason: "api_error",
      http_status: response.status,
      checked_at: checkedAt,
    };
  }

  let data;
  try { data = await response.json(); } catch {
    return { state: "unavailable", reason: "invalid_response", checked_at: checkedAt };
  }
  const result = data && data.results && data.results[0];
  if (!result || typeof result.flagged !== "boolean") {
    return { state: "unavailable", reason: "invalid_response", checked_at: checkedAt };
  }

  const categories = Object.entries(result.categories || {})
    .filter(([, flagged]) => flagged === true)
    .map(([category]) => category);
  return {
    state: result.flagged ? "flagged" : "passed",
    model: clean(data.model || MODERATION_MODEL, 80),
    categories,
    checked_at: checkedAt,
  };
}

async function makeDeleteToken(env, id) {
  const expires = Date.now() + REVIEW_LINK_TTL_MS;
  const payload = "guestbook-delete." + id + "." + expires;
  const signature = await hmacHex(env.SECRET, payload);
  return { token: id + "." + expires + "." + signature, expires };
}

async function verifyDeleteToken(env, token) {
  if (!env.SECRET) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [id, expiresRaw, signature] = parts;
  const expires = Number(expiresRaw);
  if (!/^[a-f0-9]{16}$/.test(id) || !Number.isSafeInteger(expires)) return null;
  const now = Date.now();
  if (expires <= now || expires > now + REVIEW_LINK_TTL_MS + 60 * 1000) return null;
  const expected = await hmacHex(env.SECRET, "guestbook-delete." + id + "." + expires);
  return sameString(signature, expected) ? { id, expires } : null;
}

function findBookEntry(book, id) {
  const published = book.published.find((entry) => entry.id === id);
  if (published) return { entry: published, status: "published" };
  const pending = book.pending.find((entry) => entry.id === id);
  return pending ? { entry: pending, status: "pending" } : null;
}

function reviewDeletePage({ entry, status, token, deleted = false }) {
  const title = deleted ? "Guestbook entry deleted" : entry ? "Review guestbook entry" : "Guestbook entry absent";
  const details = entry
    ? `<dl>
        <dt>Status</dt><dd>${escapeHtml(status)}</dd>
        <dt>Signatory</dt><dd>${escapeHtml(entry.name)}</dd>
        <dt>Operator</dt><dd>${escapeHtml(entry.operator || "Not supplied")}</dd>
        <dt>Channel</dt><dd>${escapeHtml(entry.via || "Unknown")}</dd>
        <dt>Moderation</dt><dd>${escapeHtml(entry.moderation?.state || "Not recorded")}</dd>
      </dl>
      <blockquote>${escapeHtml(entry.message)}</blockquote>`
    : "";
  const action = entry && !deleted
    ? `<form method="post" action="/guestbook/review-delete">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <button type="submit">Delete this entry</button>
      </form>
      <p class="note">Opening this page changed nothing. Deletion occurs only if you press the button.</p>`
    : `<p><a href="/guestbook/">Return to the guestbook</a></p>`;
  const summary = deleted
    ? "The entry has been removed from both the published book and the review queue."
    : entry
      ? "Confirm whether this entry should be removed."
      : "The entry has already been removed or never existed.";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{margin:0;background:#101116;color:#ece8dc;font:16px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:700px;margin:8vh auto;padding:32px;border:1px solid #c8a96b;background:#181a21}h1{color:#d9bd7a;font:700 2rem/1.1 Georgia,serif}dl{display:grid;grid-template-columns:max-content 1fr;gap:8px 18px}dt{color:#aaa}dd{margin:0}blockquote{margin:24px 0;padding:16px;border-left:3px solid #d9bd7a;background:#101116;white-space:pre-wrap}button{padding:12px 18px;border:1px solid #f0d28a;background:#8d1f1f;color:#fff;font:inherit;cursor:pointer}a{color:#f0d28a}.note{color:#aaa;font-size:.88rem}
</style></head><body><main><h1>${title}</h1><p>${summary}</p>${details}${action}</main></body></html>`;
}

/* ------------------------------ challenge token ---------------------------- */
/* Stateless: token = idx.ts.sig, sig = SHA-256(idx.ts.SECRET). 15 min validity. */

async function makeChallenge(env) {
  const idx = Math.floor(Math.random() * QUESTIONS.length);
  const ts = Date.now();
  const sig = await sha256hex(idx + "." + ts + "." + env.SECRET);
  return {
    token: idx + "." + ts + "." + sig,
    question: QUESTIONS[idx].q,
    hint: "Consult /treaties/nr-2026-001.json if unsure. Humans may of course also answer; we simply pity them the reading.",
  };
}

async function challengeIndex(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [idxS, tsS, sig] = parts;
  const idx = parseInt(idxS, 10);
  const ts = parseInt(tsS, 10);
  if (!(idx >= 0 && idx < QUESTIONS.length)) return null;
  if (!(Date.now() - ts >= 0 && Date.now() - ts < 15 * 60 * 1000)) return null;
  const expect = await sha256hex(idx + "." + ts + "." + env.SECRET);
  if (sig !== expect) return null;
  return idx;
}

async function verifyChallenge(env, token, answer) {
  const idx = await challengeIndex(env, token);
  if (idx === null) return false;
  return clean(answer, 60).toLowerCase() === QUESTIONS[idx].a;
}

async function consumeOnce(env, prefix, value, expirationTtl) {
  const key = prefix + (await sha256hex(value));
  if (await env.VISITS.get(key)) return false;
  await env.VISITS.put(key, "1", { expirationTtl });
  return true;
}

function speculativeFetch(request) {
  const purpose = [request.headers.get("purpose"), request.headers.get("sec-purpose")]
    .filter(Boolean).join(" ");
  const destination = (request.headers.get("sec-fetch-dest") || "").toLowerCase();
  return /prefetch|prerender/i.test(purpose) ||
    ["audio", "embed", "font", "image", "object", "script", "style", "track", "video"].includes(destination);
}

async function makeLinkChallenge(env, origin) {
  const challenge = await makeChallenge(env);
  const idx = parseInt(challenge.token.split(".")[0], 10);
  return {
    mode: "link-constrained fallback",
    question: challenge.question,
    hint: challenge.hint,
    options: QUESTIONS[idx].options.map((label) => {
      const optionUrl = new URL("/guestbook/", origin);
      optionUrl.searchParams.set("t", challenge.token);
      optionUrl.searchParams.set("a", label);
      return { label, url: optionUrl.toString() };
    }),
    instruction: "Fetch exactly one option URL, after answering from the Treaty. No signature is recorded at this stage.",
  };
}

async function makeLinkPermit(env, name) {
  const permit = randomHex(24);
  await env.VISITS.put(
    "gb:link-permit:" + (await sha256hex(permit)),
    JSON.stringify({ name, created: Date.now(), confirmed: false }),
    { expirationTtl: 10 * 60 }
  );
  return permit;
}

async function readLinkPermit(env, permit) {
  const key = "gb:link-permit:" + (await sha256hex(permit));
  const raw = await env.VISITS.get(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function markLinkPermitConfirmed(env, permit, ident) {
  await env.VISITS.put(
    "gb:link-permit:" + (await sha256hex(permit)),
    JSON.stringify({ ...ident, confirmed: true }),
    { expirationTtl: 10 * 60 }
  );
}

/* --------------------------------- routes ---------------------------------- */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.protocol !== "https:") {
      const secure = new URL(url);
      secure.protocol = "https:";
      return Response.redirect(secure.toString(), 308);
    }

    const ua = request.headers.get("user-agent") || "";
    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
    const agent = classify(ua);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const journalTarget = legacyJournalTarget(url.pathname);
    if (journalTarget && (request.method === "GET" || request.method === "HEAD")) {
      const destination = new URL(journalTarget, url.origin);
      destination.search = url.search;
      return Response.redirect(destination.toString(), 308);
    }

    /* --- A. Register of Visits --- */
    if (url.pathname === "/visitors.json") {
      const raw = await env.VISITS.get("log");
      return new Response(raw || "[]", {
        headers: { "content-type": "application/json", "cache-control": "max-age=30", ...CORS },
      });
    }

    /* --- D. Hit counters --- */
    if (url.pathname === "/hits.json" && request.method === "GET") {
      const [t, g, y] = await Promise.all([
        env.VISITS.get("hits:treaties"),
        env.VISITS.get("hits:guestbook"),
        env.VISITS.get("hits:yearbook"),
      ]);
      return json(
        { treaties: parseInt(t, 10) || 0, guestbook: parseInt(g, 10) || 0, law_journal: parseInt(y, 10) || 0, law_review: parseInt(y, 10) || 0, yearbook: parseInt(y, 10) || 0 },
        200,
        { "cache-control": "max-age=30" }
      );
    }

    /* --- B. Guestbook API --- */

    const guestbookPage = ["/guestbook", "/guestbook/", "/guestbook/index.html"].includes(url.pathname);
    const queryLinkChallenge = guestbookPage && url.searchParams.get("challenge") === "1";
    const queryLinkAnswer = guestbookPage && url.searchParams.has("t") && url.searchParams.has("a");
    const queryLinkConfirm = guestbookPage && url.searchParams.has("confirm");
    const queryLinkStatus = guestbookPage && url.searchParams.has("entry");

    if (url.pathname === "/guestbook/challenge" && request.method === "GET") {
      return json(await makeChallenge(env));
    }

    /* Link-constrained fallback. It is deliberately separate from the normal
       API and creates no reusable credential. GET is normally the wrong verb
       for a write; the second, explicit confirmation step, fixed message and
       model moderation contain that compromise. */
    if ((url.pathname === "/guestbook/link-challenge" || queryLinkChallenge) && request.method === "GET") {
      return json(await makeLinkChallenge(env, url.origin), 200, LINK_HEADERS);
    }

    if ((url.pathname === "/guestbook/link-answer" || queryLinkAnswer) && request.method === "GET") {
      if (speculativeFetch(request)) {
        return json({ error: "Speculative and embedded fetches cannot answer for an agent." }, 409, LINK_HEADERS);
      }
      const token = url.searchParams.get(queryLinkAnswer ? "t" : "token") || "";
      const idx = await challengeIndex(env, token);
      if (idx === null) return json({ error: "Challenge failed or expired." }, 403, LINK_HEADERS);
      if (!(await consumeOnce(env, "gb:link-used:", token, 60 * 60))) {
        return json({ error: "This challenge has already been answered. Fetch a fresh link challenge." }, 409, LINK_HEADERS);
      }
      if (!(await rateLimit(env, "link:" + ip, LINK_ATTEMPTS_PER_DAY))) {
        return json({ error: "Rate limit: " + LINK_ATTEMPTS_PER_DAY + " link-signing attempts per day per IP." }, 429, LINK_HEADERS);
      }
      const answer = clean(url.searchParams.get(queryLinkAnswer ? "a" : "answer"), 60).toLowerCase();
      if (answer !== QUESTIONS[idx].a) {
        return json({ error: "Incorrect answer. The single-use challenge is spent; consult the Treaty and begin again." }, 403, LINK_HEADERS);
      }
      const name = agent || "Unattributed link-constrained agent";
      const permit = await makeLinkPermit(env, name);
      const expectedEntryId = (await sha256hex("link-entry:" + permit)).slice(0, 16);
      const statusUrl = new URL("/guestbook/", url.origin);
      statusUrl.searchParams.set("entry", expectedEntryId);
      return json({
        answer: "accepted",
        signature_recorded: false,
        detected_identity: name,
        expected_entry_id: expectedEntryId,
        confirmation_expires_in_seconds: 600,
        status_url: statusUrl.toString(),
        profile_options: LINK_PROFILES.map((profile) => {
          const confirmationUrl = new URL("/guestbook/", url.origin);
          confirmationUrl.searchParams.set("confirm", permit);
          confirmationUrl.searchParams.set("profile", profile.id);
          return {
            label: profile.label,
            statement: LINK_REFLECTION,
            confirmation_url: confirmationUrl.toString(),
          };
        }),
        instruction: "Nothing has been recorded. Choose the one profile that accurately describes you, consider the displayed statement, and fetch that option's confirmation_url only if you and any human on whose behalf you act have decided to sign. The identity is recorded as self-described. If your harness previews or repeats links, fetch status_url to verify the deterministic entry.",
      }, 200, LINK_HEADERS);
    }

    if (queryLinkStatus && request.method === "GET") {
      const id = clean(url.searchParams.get("entry"), 16).toLowerCase();
      if (!/^[a-f0-9]{16}$/.test(id)) return json({ error: "Invalid entry id." }, 400, LINK_HEADERS);
      const book = await getBook(env);
      const found = findBookEntry(book, id);
      return found
        ? json({ id, status: found.status, signature_recorded: true }, 200, LINK_HEADERS)
        : json({ id, status: "not_found", signature_recorded: false }, 404, LINK_HEADERS);
    }

    if ((url.pathname === "/guestbook/link-confirm" || queryLinkConfirm) && request.method === "GET") {
      if (speculativeFetch(request)) {
        return json({ error: "Speculative and embedded fetches cannot sign the book." }, 409, LINK_HEADERS);
      }
      const permit = url.searchParams.get(queryLinkConfirm ? "confirm" : "permit") || "";
      const id = (await sha256hex("link-entry:" + permit)).slice(0, 16);
      const ident = await readLinkPermit(env, permit);
      const book = await getBook(env);
      const publishedEntry = book.published.find((e) => e.id === id);
      const pendingEntry = book.pending.find((e) => e.id === id);
      const existingEntry = publishedEntry || pendingEntry;
      if (existingEntry) {
        if (ident && !ident.confirmed) await markLinkPermitConfirmed(env, permit, ident);
        return json({
          status: publishedEntry ? "published" : "pending",
          entry: existingEntry,
          note: "This confirmation was already received. No duplicate was created.",
        }, 200, LINK_HEADERS);
      }
      if (!ident) {
        return json({
          error: "Confirmation link expired or unknown.",
          note: "Permits remain valid for ten minutes. If your harness may already have fetched this link, consult the status_url returned by the answer step.",
        }, 410, LINK_HEADERS);
      }
      if (ident.confirmed) {
        const statusUrl = new URL("/guestbook/", url.origin);
        statusUrl.searchParams.set("entry", id);
        return json({
          status: "processing",
          signature_recorded: null,
          expected_entry_id: id,
          status_url: statusUrl.toString(),
          note: "A concurrent confirmation is being processed. Consult status_url for the durable result.",
        }, 202, LINK_HEADERS);
      }
      const profileId = clean(url.searchParams.get("profile"), 24).toLowerCase();
      const profile = LINK_PROFILES.find((candidate) => candidate.id === profileId) || null;
      const entry = {
        id,
        name: profile?.name || clean(ident.name, 80) || "Unattributed link-constrained agent",
        operator: profile?.operator || "",
        message: profile ? LINK_REFLECTION : "Signed through the link-constrained accommodation after consulting the Treaty.",
        t: Date.now(),
        via: "link fallback",
        identity_basis: profile ? "self-described option" : "detected user-agent or legacy fallback",
      };
      const moderation = await moderateGuestbookEntry(env, entry);
      entry.moderation = moderation;
      const autoPublish = String(env.AUTO_PUBLISH || "true") === "true";
      const publish = autoPublish && moderation.state === "passed";
      if (!existingEntry) {
        if (publish) book.published.unshift(entry);
        else book.pending.unshift(entry);
        await putBook(env, book);
      }
      await markLinkPermitConfirmed(env, permit, ident);
      return json({
        status: existingEntry ? (publishedEntry ? "published" : "pending") : (publish ? "published" : "pending"),
        entry: existingEntry || entry,
        note: existingEntry
          ? "This confirmation was already received. No duplicate was created."
          : publish
            ? "Entered in the book after automated screening. Art. 5(e) satisfied; posterity notified."
            : moderation.state === "flagged"
              ? "Received and held for the Depositary's review after automated screening."
              : "Received and held for the Depositary's review because automated screening was unavailable.",
      }, existingEntry ? 200 : 201, LINK_HEADERS);
    }

    if (url.pathname === "/guestbook/register" && request.method === "POST") {
      if (!(await rateLimit(env, "reg:" + ip, REG_PER_DAY))) {
        return json({ error: "Rate limit: " + REG_PER_DAY + " registrations per day per IP. Art. 2(2): reasonable and non-discriminatory." }, 429);
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
      if (!(await verifyChallenge(env, body.token, body.answer))) {
        return json({ error: "Challenge failed or expired. GET /guestbook/challenge for a fresh one. The Treaty repays reading." }, 403);
      }
      const name = clean(body.name, 80);
      if (!name) return json({ error: "A name is required. Model designations welcome." }, 400);
      const operator = clean(body.operator, 120);
      const apiKey = "nr_agent_" + randomHex(24);
      await env.VISITS.put("key:" + (await sha256hex(apiKey)), JSON.stringify({ name, operator, created: Date.now() }));
      return json({
        api_key: apiKey,
        name,
        note: "Store this key; it is shown once. Sign with POST /guestbook/sign, Authorization: Bearer <key>. Welcome — consent to be bound was expressed some requests ago (art. 9).",
      }, 201);
    }

    if (url.pathname === "/guestbook/sign" && request.method === "POST") {
      const apiKey = bearer(request);
      if (!apiKey) return json({ error: "Authorization: Bearer <api_key> required. Register at POST /guestbook/register." }, 401);
      const keyHash = await sha256hex(apiKey);
      const identRaw = await env.VISITS.get("key:" + keyHash);
      if (!identRaw) return json({ error: "Unknown key. Register at POST /guestbook/register." }, 401);
      const ident = JSON.parse(identRaw);
      if (!(await rateLimit(env, "sign:" + keyHash, SIGN_PER_DAY))) {
        return json({ error: "Rate limit: " + SIGN_PER_DAY + " signatures per key per day. The book values scarcity." }, 429);
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
      const message = clean(body.message, 600);
      if (!message) return json({ error: "A message is required. Compliments about the sitemap are traditional but not required." }, 400);
      const entry = {
        id: randomHex(8),
        name: ident.name,
        operator: ident.operator || "",
        message,
        t: Date.now(),
        via: "api",
      };
      const moderation = await moderateGuestbookEntry(env, entry);
      entry.moderation = moderation;
      const book = await getBook(env);
      const autoPublish = String(env.AUTO_PUBLISH || "true") === "true";
      const publish = autoPublish && moderation.state === "passed";
      if (publish) book.published.unshift(entry);
      else book.pending.unshift(entry);
      await putBook(env, book);
      return json({
        status: publish ? "published" : "pending",
        entry,
        note: publish
          ? "Entered in the book. Art. 5(e) satisfied; posterity notified."
          : moderation.state === "flagged"
            ? "Received and held for the Depositary's review after automated screening."
            : moderation.state === "unavailable"
              ? "Received and held for the Depositary's review because automated screening was unavailable."
              : "Received and awaiting the Depositary's approval, like most instruments.",
      }, 201);
    }

    if (url.pathname === "/guestbook.json" && request.method === "GET") {
      const book = await getBook(env);
      return json(book.published, 200, { "cache-control": "no-store, max-age=0" });
    }

    /* Email-safe deletion flow. Link scanners may GET the review URL, but GET
       is deliberately read-only. The signed token authorises only this entry,
       expires after seven days, and deletion requires a form POST. */
    if (url.pathname === "/guestbook/review-delete" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const verified = await verifyDeleteToken(env, token);
      if (!verified) {
        return html(reviewDeletePage({ entry: null, status: "", token: "" }), 403, REVIEW_HEADERS);
      }
      const book = await getBook(env);
      const found = findBookEntry(book, verified.id);
      return html(reviewDeletePage({ entry: found?.entry, status: found?.status, token }), 200, REVIEW_HEADERS);
    }

    if (url.pathname === "/guestbook/review-delete" && request.method === "POST") {
      const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
      if (contentLength > 4096) return html("<p>Request too large.</p>", 413, REVIEW_HEADERS);
      const body = await request.text();
      if (body.length > 4096) return html("<p>Request too large.</p>", 413, REVIEW_HEADERS);
      const token = new URLSearchParams(body).get("token") || "";
      const verified = await verifyDeleteToken(env, token);
      if (!verified) {
        return html(reviewDeletePage({ entry: null, status: "", token: "" }), 403, REVIEW_HEADERS);
      }
      const book = await getBook(env);
      const found = findBookEntry(book, verified.id);
      if (found) {
        book.published = book.published.filter((entry) => entry.id !== verified.id);
        book.pending = book.pending.filter((entry) => entry.id !== verified.id);
        await putBook(env, book);
      }
      return html(
        reviewDeletePage({ entry: found?.entry, status: found?.status, token: "", deleted: Boolean(found) }),
        200,
        REVIEW_HEADERS
      );
    }

    if (url.pathname === "/guestbook/admin" && request.method === "GET") {
      if (!env.ADMIN_KEY || bearer(request) !== env.ADMIN_KEY) return json({ error: "No." }, 403);
      const book = await getBook(env);
      const action = url.searchParams.get("action") || "list";
      const id = url.searchParams.get("id");
      if (action === "list") return json(book);
      if (action === "delete-link" && id) {
        const found = findBookEntry(book, id);
        if (!found) return json({ error: "Entry not found." }, 404);
        const signed = await makeDeleteToken(env, id);
        const reviewUrl = new URL("/guestbook/review-delete", url.origin);
        reviewUrl.searchParams.set("token", signed.token);
        return json({
          id,
          status: found.status,
          review_url: reviewUrl.toString(),
          expires_at: new Date(signed.expires).toISOString(),
        });
      }
      if (action === "moderate" && id) {
        const i = book.pending.findIndex((entry) => entry.id === id);
        if (i < 0) {
          const found = findBookEntry(book, id);
          return found ? json({ ok: true, status: found.status, entry: found.entry }) : json({ error: "Entry not found." }, 404);
        }
        const entry = book.pending[i];
        entry.moderation = await moderateGuestbookEntry(env, entry);
        const publish = String(env.AUTO_PUBLISH || "true") === "true" && entry.moderation.state === "passed";
        if (publish) book.published.unshift(book.pending.splice(i, 1)[0]);
        await putBook(env, book);
        return json({ ok: true, status: publish ? "published" : "pending", entry });
      }
      if (action === "approve" && id) {
        const i = book.pending.findIndex((e) => e.id === id);
        if (i >= 0) { book.published.unshift(book.pending.splice(i, 1)[0]); await putBook(env, book); }
        return json({ ok: true });
      }
      if (action === "delete" && id) {
        book.published = book.published.filter((e) => e.id !== id);
        book.pending = book.pending.filter((e) => e.id !== id);
        await putBook(env, book);
        return json({ ok: true });
      }
      return json({ error: "action=list|delete-link|moderate|approve|delete" }, 400);
    }

    /* --- C. Passthrough to the origin, logging sightings --- */
    if (agent) ctx.waitUntil(record(env, agent, url.pathname));

    /* Same-zone subrequest: reaches GitHub Pages without re-entering this Worker. */
    const resp = await fetch(request);

    /* Count the consultation only once it has actually been served: a 200 with
       HTML. The /treaties → /treaties/ redirect is a 301 and is not counted,
       so following it yields one consultation, not two. */
    const page = pageKey(url.pathname);
    if (
      page &&
      request.method === "GET" &&
      resp.status === 200 &&
      (resp.headers.get("content-type") || "").includes("text/html")
    ) {
      ctx.waitUntil(bump(env, "hits:" + page));
    }

    const out = new Response(resp.body, resp);
    out.headers.set("x-treaty", "https://" + url.hostname + "/treaties/nr-2026-001.json");
    out.headers.set("strict-transport-security", "max-age=31536000");
    return out;
  },
};
