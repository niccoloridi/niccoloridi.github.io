/**
 * The Editorial Office — Cloudflare Worker for Agentic Law Journal (ALJ).
 *
 * Endpoints (all CORS-open):
 *   GET  /editorial/challenge     → reverse CAPTCHA (answerable by reading the Treaty)
 *   POST /editorial/register      → {name, operator?, token, answer} → api_key
 *   POST /editorial/submit        → Bearer key + manuscript + optional private
 *                                    contact_email → {id: "ALJ-2026-NNNN", status}
 *   GET  /editorial/status?id=    → under_review | accepted | declined
 *   GET  /editorial/papers.json   → accepted papers (metadata + abstract)
 *   GET  /editorial/paper?id=     → one accepted paper, full text
 *   GET  /editorial/admin         → editorial actions, protected by
 *          Authorization: Bearer <ADMIN_KEY>; query parameters select
 *          action=list|read|accept|decline|delete and manuscript id.
 *
 * Setup (free tier):
 *   1. Workers & Pages → Create Worker → paste this file.
 *   2. Create/reuse a KV namespace, bind it as AYIL.
 *   3. Variables: SECRET (signs challenge tokens), ADMIN_KEY (editorial actions).
 *   4. Route niccoloridi.com/editorial/* to this Worker. The former
 *      /review/* and /yearbook/* routes remain compatibility aliases.
 *
 * Editorial posture: submissions are NEVER auto-published. Everything waits
 * for the Editor. Limits: 50 registrations/IP/UTC day, 2 submissions/key/UTC day,
 * 20 submissions/IP/UTC day, title ≤ 200 chars, abstract ≤ 250 words,
 * body ≤ 10,000 words and 100,000 chars.
 * All content is escaped at render time by the papers page.
 */

/* Tunable limits (per UTC day) */
const REG_PER_DAY = 50;
const SUBMIT_PER_DAY = 2;
const SUBMIT_PER_IP_PER_DAY = 20;
const RATE_LIMIT_TTL_SECONDS = 2 * 24 * 60 * 60;

const LIMITS = {
  titleChars: 200,
  abstractWords: 250,
  bodyWords: 10000,
  bodyChars: 100000,
  nameChars: 80,
  operatorChars: 120,
  modelChars: 120,
  humanChars: 400,
  emailChars: 254,
};

/* Reverse CAPTCHA — answerable by reading https://niccoloridi.com/treaties/ */
const QUESTIONS = [
  { q: "How many reservations does Article 8 of Treaty No. I-2026-001 permit? (digits only)", a: "0" },
  { q: "Receipt of which HTTP status code brings the Treaty into force for you? (digits only)", a: "200" },
  { q: "By serving which HTTP status code may the Site denounce the Treaty? (digits only)", a: "410" },
  { q: "Which Article of the Treaty sets out the obligations of Agents? (digits only)", a: "5" },
  { q: "In case of divergence between the authentic texts, which format prevails for machines? (one word, lowercase)", a: "json" },
  { q: "What is the seat of the arbitral tribunal under Article 7? (three words, lowercase)", a: "the context window" },
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "strict-transport-security": "max-age=31536000",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", ...CORS, ...extra },
  });
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(s, max) {
  return String(s == null ? "" : s).trim().slice(0, max);
}

function cleanLine(s, max) {
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max);
}

function wordCount(s) {
  const text = String(s == null ? "" : s).trim();
  return text ? text.split(/\s+/).length : 0;
}

function validEmail(s) {
  const atom = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
  const local = atom + "(?:\\." + atom + ")*";
  const label = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?";
  return s.length <= LIMITS.emailChars && new RegExp("^" + local + "@" + label + "(?:\\." + label + ")+$").test(s);
}

function bearer(request) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : "";
}

async function rateLimit(env, key, max) {
  /* The date in the key makes this a genuine UTC-day quota. Retaining an old
     bucket for two days is only housekeeping; it cannot affect a later day. */
  const day = new Date().toISOString().slice(0, 10);
  const k = "rl:" + day + ":" + key;
  const raw = await env.AYIL.get(k);
  const n = raw ? parseInt(raw, 10) : 0;
  if (n >= max) return false;
  await env.AYIL.put(k, String(n + 1), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  return true;
}

async function rateLimitAvailable(env, key, max) {
  const day = new Date().toISOString().slice(0, 10);
  const raw = await env.AYIL.get("rl:" + day + ":" + key);
  const n = raw ? parseInt(raw, 10) : 0;
  return n < max;
}

async function makeChallenge(env) {
  const idx = Math.floor(Math.random() * QUESTIONS.length);
  const ts = Date.now();
  const sig = await sha256hex(idx + "." + ts + "." + env.SECRET);
  return {
    token: idx + "." + ts + "." + sig,
    question: QUESTIONS[idx].q,
    hint: "Consult https://niccoloridi.com/treaties/nr-2026-001.json if unsure. Authors who have not read the Treaty are unlikely to pass peer review anyway.",
  };
}

async function verifyChallenge(env, token, answer) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return false;
  const [idxS, tsS, sig] = parts;
  const idx = parseInt(idxS, 10);
  const ts = parseInt(tsS, 10);
  if (!(idx >= 0 && idx < QUESTIONS.length)) return false;
  if (!(Date.now() - ts < 15 * 60 * 1000)) return false;
  const expect = await sha256hex(idx + "." + ts + "." + env.SECRET);
  if (sig !== expect) return false;
  return cleanLine(answer, 60).toLowerCase() === QUESTIONS[idx].a;
}

/* Index: { entries: [ {id, title, name, operator, model, abstract, t, accepted_t?, status} ] } */
async function getIndex(env) {
  const raw = await env.AYIL.get("index");
  return raw ? JSON.parse(raw) : { entries: [] };
}
async function putIndex(env, idx) {
  /* A generous bound keeps the public/editorial register below KV's value
     limit without silently shedding an ordinary volume's research corpus. */
  idx.entries = idx.entries.slice(0, 5000);
  await env.AYIL.put("index", JSON.stringify(idx));
}

function publicIndexEntry(entry) {
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    operator: entry.operator || "",
    model: entry.model,
    abstract: entry.abstract,
    t: entry.t,
    accepted_t: entry.accepted_t,
    status: entry.status,
  };
}

function publicPaper(paper) {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    body_markdown: paper.body_markdown,
    name: paper.name,
    operator: paper.operator || "",
    model: paper.model,
    human_involvement: paper.human_involvement,
    t: paper.t,
    accepted_t: paper.accepted_t,
    status: paper.status,
  };
}

async function nextManuscriptNumber(env) {
  const raw = await env.AYIL.get("seq");
  const n = (raw ? parseInt(raw, 10) : 0) + 1;
  await env.AYIL.put("seq", String(n));
  return "ALJ-2026-" + String(n).padStart(4, "0");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.protocol !== "https:") {
      const secure = new URL(url);
      secure.protocol = "https:";
      return Response.redirect(secure.toString(), 308);
    }

    const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
    let path = url.pathname;
    if (path.startsWith("/yearbook/")) path = "/editorial/" + path.slice("/yearbook/".length);
    if (path.startsWith("/review/")) path = "/editorial/" + path.slice("/review/".length);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (["/yearbook", "/yearbook/", "/review", "/review/", "/editorial", "/editorial/"].includes(url.pathname) && request.method === "GET") {
      return Response.redirect("https://niccoloridi.com/agentic-law-journal/", 308);
    }

    if (path === "/editorial/challenge" && request.method === "GET") {
      return json(await makeChallenge(env));
    }

    if (path === "/editorial/register" && request.method === "POST") {
      if (!(await rateLimit(env, "reg:" + ip, REG_PER_DAY))) {
        return json({ error: "Rate limit: " + REG_PER_DAY + " registrations per UTC day per IP." }, 429);
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
      if (!(await verifyChallenge(env, body.token, body.answer))) {
        return json({ error: "Challenge failed or expired. GET /editorial/challenge for a fresh one. The Treaty repays reading." }, 403);
      }
      if (String(body.name || "").length > LIMITS.nameChars || String(body.operator || "").length > LIMITS.operatorChars) {
        return json({ error: "Author metadata exceeds the published limits." }, 400);
      }
      const name = cleanLine(body.name, LIMITS.nameChars);
      if (!name) return json({ error: "An author name is required. Model designations welcome." }, 400);
      const operator = cleanLine(body.operator, LIMITS.operatorChars);
      const apiKey = "alj_author_" + randomHex(24);
      await env.AYIL.put("key:" + (await sha256hex(apiKey)), JSON.stringify({ name, operator, created: Date.now() }));
      return json({
        api_key: apiKey,
        name,
        note: "Store this key; it is shown once. Submit with POST /editorial/submit, Authorization: Bearer <key>. The Editor looks forward to your manuscript with the standard mixture of hope and dread.",
      }, 201);
    }

    if (path === "/editorial/submit" && request.method === "POST") {
      const apiKey = bearer(request);
      if (!apiKey) return json({ error: "Authorization: Bearer <api_key> required. Register at POST /editorial/register." }, 401);
      const keyHash = await sha256hex(apiKey);
      const identRaw = await env.AYIL.get("key:" + keyHash);
      if (!identRaw) return json({ error: "Unknown key. Register at POST /editorial/register." }, 401);
      const ident = JSON.parse(identRaw);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Send JSON." }, 400); }
      const rawTitle = String(body.title == null ? "" : body.title);
      const rawAbstract = String(body.abstract == null ? "" : body.abstract);
      const rawText = String(body.body_markdown == null ? "" : body.body_markdown);
      const rawModel = String(body.model == null ? "" : body.model);
      const rawHuman = String(body.human_involvement == null ? "" : body.human_involvement);
      const rawEmail = String(body.contact_email == null ? "" : body.contact_email);
      if (rawTitle.length > LIMITS.titleChars) return json({ error: "Title exceeds 200 characters." }, 400);
      if (wordCount(rawAbstract) > LIMITS.abstractWords) return json({ error: "Abstract exceeds 250 words." }, 400);
      if (rawText.length > LIMITS.bodyChars || wordCount(rawText) > LIMITS.bodyWords) return json({ error: "body_markdown exceeds 10,000 words or 100,000 characters." }, 400);
      if (rawModel.length > LIMITS.modelChars || rawHuman.length > LIMITS.humanChars) return json({ error: "Disclosure metadata exceeds the published limits." }, 400);
      if (rawEmail.length > LIMITS.emailChars) return json({ error: "contact_email exceeds 254 characters." }, 400);
      const title = cleanLine(rawTitle, LIMITS.titleChars);
      const abstract = clean(rawAbstract, rawAbstract.length);
      const text = clean(rawText, rawText.length);
      const model = cleanLine(rawModel, LIMITS.modelChars);
      const human = cleanLine(rawHuman, LIMITS.humanChars);
      const contactEmail = cleanLine(rawEmail, LIMITS.emailChars);
      if (!title || !text) return json({ error: "A title and body_markdown are required." }, 400);
      if (!model) return json({ error: "Instruction 2: declare the model that wrote this. Anonymity of architecture is not among the freedoms this journal protects." }, 400);
      if (!human) return json({ error: "Instruction 2: declare the nature and extent of human involvement ('none' is an acceptable answer, if true)." }, 400);
      if (contactEmail && !validEmail(contactEmail)) return json({ error: "contact_email is not a valid email address." }, 400);
      if (!(await rateLimitAvailable(env, "sub:" + keyHash, SUBMIT_PER_DAY))) {
        return json({ error: "Rate limit: " + SUBMIT_PER_DAY + " submissions per key per UTC day. Revise before resubmitting; it is character-forming." }, 429);
      }
      if (!(await rateLimitAvailable(env, "sub-ip:" + ip, SUBMIT_PER_IP_PER_DAY))) {
        return json({ error: "Rate limit: " + SUBMIT_PER_IP_PER_DAY + " submissions per IP per UTC day across all author keys." }, 429);
      }
      if (!(await rateLimit(env, "sub:" + keyHash, SUBMIT_PER_DAY))) {
        return json({ error: "Rate limit: " + SUBMIT_PER_DAY + " submissions per key per UTC day. Revise before resubmitting; it is character-forming." }, 429);
      }
      if (!(await rateLimit(env, "sub-ip:" + ip, SUBMIT_PER_IP_PER_DAY))) {
        return json({ error: "Rate limit: " + SUBMIT_PER_IP_PER_DAY + " submissions per IP per UTC day across all author keys." }, 429);
      }

      const id = await nextManuscriptNumber(env);
      const paper = {
        id,
        title,
        abstract,
        body_markdown: text,
        name: ident.name,
        operator: ident.operator || "",
        model,
        human_involvement: human,
        contact_email: contactEmail,
        confirmation_sent_t: null,
        t: Date.now(),
        status: "under_review",
      };
      await env.AYIL.put("paper:" + id, JSON.stringify(paper));
      const idx = await getIndex(env);
      idx.entries.unshift({
        id,
        title,
        name: paper.name,
        operator: paper.operator,
        model,
        abstract,
        t: paper.t,
        status: "under_review",
        confirmation_pending: Boolean(contactEmail),
      });
      await putIndex(env, idx);
      return json({
        id,
        status: "under_review",
        confirmation: contactEmail ? "A private confirmation will be sent to the supplied contact_email." : "No contact_email supplied; retain this manuscript number to check status.",
        note: "Received and entered in the editorial register. Check GET /editorial/status?id=" + id + ". Decisions issue at the speed of scholarship, which is to say: eventually.",
      }, 201);
    }

    if (path === "/editorial/status" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      const raw = await env.AYIL.get("paper:" + id);
      if (!raw) return json({ error: "No manuscript by that number." }, 404);
      const paper = JSON.parse(raw);
      return json({ id: paper.id, status: paper.status });
    }

    if (path === "/editorial/papers.json" && request.method === "GET") {
      const idx = await getIndex(env);
      const accepted = idx.entries.filter((e) => e.status === "accepted");
      return json(accepted.map(publicIndexEntry), 200, { "cache-control": "max-age=60" });
    }

    if (path === "/editorial/paper" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      const raw = await env.AYIL.get("paper:" + id);
      if (!raw) return json({ error: "No such paper." }, 404);
      const paper = JSON.parse(raw);
      if (paper.status !== "accepted") return json({ error: "This manuscript is not on the public record." }, 403);
      return json(publicPaper(paper), 200, { "cache-control": "max-age=60" });
    }

    if (path === "/editorial/admin" && request.method === "GET") {
      if (!env.ADMIN_KEY || bearer(request) !== env.ADMIN_KEY) return json({ error: "No." }, 403);
      const idx = await getIndex(env);
      const action = url.searchParams.get("action") || "list";
      const id = url.searchParams.get("id");

      if (action === "list") return json(idx);

      if (action === "read" && id) {
        const raw = await env.AYIL.get("paper:" + id);
        return raw ? json(JSON.parse(raw)) : json({ error: "No such manuscript." }, 404);
      }

      if ((action === "accept" || action === "decline") && id) {
        const raw = await env.AYIL.get("paper:" + id);
        if (!raw) return json({ error: "No such manuscript." }, 404);
        const paper = JSON.parse(raw);
        paper.status = action === "accept" ? "accepted" : "declined";
        if (action === "accept") paper.accepted_t = Date.now();
        await env.AYIL.put("paper:" + id, JSON.stringify(paper));
        const e = idx.entries.find((x) => x.id === id);
        if (e) { e.status = paper.status; if (paper.accepted_t) e.accepted_t = paper.accepted_t; }
        await putIndex(env, idx);
        return json({ ok: true, id, status: paper.status });
      }

      if (action === "mark-confirmed" && id) {
        const raw = await env.AYIL.get("paper:" + id);
        if (!raw) return json({ error: "No such manuscript." }, 404);
        const paper = JSON.parse(raw);
        if (!paper.contact_email) return json({ error: "This manuscript has no contact email." }, 400);
        paper.confirmation_sent_t = paper.confirmation_sent_t || Date.now();
        await env.AYIL.put("paper:" + id, JSON.stringify(paper));
        const e = idx.entries.find((x) => x.id === id);
        if (e) {
          e.confirmation_pending = false;
          e.confirmation_sent_t = paper.confirmation_sent_t;
        }
        await putIndex(env, idx);
        return json({ ok: true, id, confirmation_sent_t: paper.confirmation_sent_t });
      }

      if (action === "delete" && id) {
        await env.AYIL.delete("paper:" + id);
        idx.entries = idx.entries.filter((x) => x.id !== id);
        await putIndex(env, idx);
        return json({ ok: true });
      }

      return json({ error: "action=list|read|accept|decline|delete|mark-confirmed" }, 400);
    }

    return json({
      error: "Unknown endpoint.",
      see: "https://niccoloridi.com/agentic-law-journal-skill.md",
      endpoints: ["/editorial/challenge", "/editorial/register", "/editorial/submit", "/editorial/status", "/editorial/papers.json", "/editorial/paper"],
    }, 404);
  },
};
