import test from "node:test";
import assert from "node:assert/strict";
import worker, { GuestbookCircuitBreaker } from "./border-post.js";

// In-memory bindings: these tests exercise routing and safety boundaries, not
// Cloudflare KV propagation or concurrent production writes.
function fixture() {
  const values = new Map();
  const writes = [];
  const counters = new Map();
  const storage = {
    async get(key) { return counters.get(key); },
    async put(key, value) { counters.set(key, value); },
    async transaction(fn) { return fn(storage); },
  };
  const circuit = new GuestbookCircuitBreaker({ storage });
  const env = {
    SECRET: "local-test-secret",
    AUTO_PUBLISH: "true",
    VISITS: {
      async get(key) { return values.get(key) ?? null; },
      async put(key, value) { writes.push(key); values.set(key, value); },
    },
    GUESTBOOK_CIRCUIT: {
      idFromName(name) { return name; },
      get() { return { fetch: (url, init) => circuit.fetch(new Request(url, init)) }; },
    },
    GUESTBOOK_BURST: { async limit() { return { success: true }; } },
  };
  const call = (path, init = {}) => worker.fetch(
    new Request(new URL(path, "https://niccoloridi.com"), init), env,
    { waitUntil() { throw new Error("Unexpected origin request"); } }
  );
  return { env, values, writes, counters, call };
}

const answers = ["0", "200", "410", "5", "json", "the context window"];
const reflection = 'A thoughtful encounter with the Treaty: café, a & b, #references, and <plain text>.';
const decode = (s) => s.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");

async function answerChallenge(f) {
  const response = await f.call("/guestbook/?challenge=1");
  const data = await response.json();
  const index = Number(new URL(data.options[0].url).searchParams.get("t").split(".")[0]);
  const answer = await f.call(data.options.find((option) => option.label === answers[index]).url);
  assert.equal(answer.status, 200);
  return answer.json();
}

function prepareUrl(answer, profile = "grok", message = reflection) {
  const url = new URL(answer.profile_options.find((p) => p.profile === profile).preparation_base_url);
  url.searchParams.set("message", message);
  return url;
}

test("JSON clients keep their existing protocol; challenges cannot be cached", async () => {
  const f = fixture();
  for (const path of ["/guestbook/challenge", "/guestbook/?challenge=1", "/guestbook/link-challenge"]) {
    const r = await f.call(path);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /application\/json/);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.ok((await r.json()).question);
  }
  assert.equal(f.writes.length, 0);
  const answer = await answerChallenge(f);
  assert.equal(answer.signature_recorded, false);
  const direct = new URL(answer.profile_options[0].confirmation_base_url);
  direct.searchParams.set("message", reflection);
  const signed = await f.call(direct);
  assert.equal(signed.status, 201);
  assert.equal((await signed.json()).status, "pending");
});

test("the original POST registration and signing API still works", async () => {
  const f = fixture();
  const challenge = await (await f.call("/guestbook/challenge")).json();
  const registered = await f.call("/guestbook/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Local API test", token: challenge.token, answer: answers[Number(challenge.token.split(".")[0])] }),
  });
  assert.equal(registered.status, 201);
  const identity = await registered.json();
  const signed = await f.call("/guestbook/sign", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${identity.api_key}` },
    body: JSON.stringify({ message: reflection }),
  });
  assert.equal(signed.status, 201);
  const result = await signed.json();
  assert.equal(result.entry.via, "api");
  assert.equal(result.entry.name, "Local API test");
  assert.equal(result.status, "pending");
});

test("the ordinary challenge exposes a working GET route without a guide fetch or POST", async () => {
  const f = fixture();
  const challenge = await (await f.call("/guestbook/challenge")).json();
  assert.equal(challenge.link_options.length, 4);
  const expected = answers[Number(challenge.token.split(".")[0])];
  for (const option of challenge.link_options) {
    assert.equal(new URL(option.url).searchParams.get("t"), challenge.token);
  }
  const response = await f.call(challenge.link_options.find((option) => option.label === expected).url);
  assert.equal(response.status, 200);
  const accepted = await response.json();
  assert.equal(accepted.signature_recorded, false);
  assert.ok(accepted.profile_options[0].confirmation_base_url);
  assert.equal(f.values.has("gb"), false);
});

test("preview is read-only, produces a complete URL, and preserves encoded content", async () => {
  const f = fixture();
  const answer = await answerChallenge(f);
  const url = prepareUrl(answer, "other");
  url.searchParams.set("name", 'Agent <test> & "visitor"');
  url.searchParams.set("operator", "Local tests");
  const beforeWrites = [...f.writes];
  const beforeCounters = [...f.counters];
  const preview = await (await f.call(url)).json();
  assert.equal(preview.signature_recorded, false);
  assert.equal(preview.preview.message, reflection);
  assert.deepEqual(f.writes, beforeWrites);
  assert.deepEqual([...f.counters], beforeCounters);
  assert.equal(f.values.has("gb"), false);
  const signed = await f.call(preview.confirmation_url);
  assert.equal(signed.status, 201);
  const result = await signed.json();
  assert.equal(result.status, "pending");
  assert.equal(result.entry.name, 'Agent <test> & "visitor"');
  assert.equal(result.entry.message, reflection);
  assert.equal(result.entry.moderation.state, "unavailable");
  const repeated = await f.call(preview.confirmation_url);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).entry.id, result.entry.id);
  assert.equal(JSON.parse(f.values.get("gb")).pending.length, 1);
  const status = await (await f.call(preview.status_url)).json();
  assert.equal(status.signature_recorded, true);
  assert.equal(status.status, "pending");
});

test("HTML challenge, native form, preview and receipt work without JavaScript", async () => {
  const f = fixture();
  const challenge = await f.call("/guestbook/?challenge=1&format=html");
  assert.match(challenge.headers.get("content-type"), /text\/html/);
  assert.match(challenge.headers.get("content-security-policy"), /default-src 'none'/);
  const markup = await challenge.text();
  const options = [...markup.matchAll(/href="([^"]+)"/g)].map((m) => decode(m[1]))
    .filter((value) => value.includes("?t="));
  assert.equal(options.length, 4);
  const index = Number(new URL(options[0]).searchParams.get("t").split(".")[0]);
  const form = await (await f.call(options.find((value) => new URL(value).searchParams.get("a") === answers[index]))).text();
  assert.match(form, /<form method="get" action="\/guestbook\/"/);
  assert.doesNotMatch(form, /<script/i);
  assert.equal(f.values.has("gb"), false);
  const permit = form.match(/name="prepare" value="([^"]+)"/)[1];
  const reviewUrl = new URL("https://niccoloridi.com/guestbook/");
  reviewUrl.search = new URLSearchParams({ prepare: permit, format: "html", profile: "grok", message: reflection });
  const writes = f.writes.length;
  const preview = await (await f.call(reviewUrl)).text();
  assert.equal(f.writes.length, writes);
  assert.match(preview, /&lt;plain text&gt;/);
  assert.doesNotMatch(preview, /<plain text>/);
  const finalUrl = decode(preview.match(/href="([^"]+)">Sign and submit this reflection/)[1]);
  const receipt = await f.call(finalUrl);
  assert.equal(receipt.status, 201);
  assert.match(await receipt.text(), /Status: pending/);
});

test("invalid or expired permits cannot preview or sign", async () => {
  const f = fixture();
  for (const action of ["prepare", "confirm"]) {
    const r = await f.call(`/guestbook/?${action}=unknown&profile=grok&message=${encodeURIComponent(reflection)}`);
    assert.equal(r.status, 410);
  }
  assert.equal(f.writes.length, 0);
});

test("preview enforces identity and message limits without consuming the permit", async () => {
  const f = fixture();
  const answer = await answerChallenge(f);
  const writes = f.writes.length;
  for (const [key, value] of [["message", "short"], ["message", "x".repeat(601)], ["profile", "invented"], ["profile", "other"], ["name", "x".repeat(81)], ["operator", "x".repeat(121)]]) {
    const url = prepareUrl(answer);
    url.searchParams.set(key, value);
    assert.equal((await f.call(url)).status, 400, key);
  }
  assert.equal(f.writes.length, writes);
  assert.equal((await f.call(prepareUrl(answer))).status, 200);
});

test("preview cannot be combined with another action to cause a write", async () => {
  const f = fixture();
  const challenge = await (await f.call("/guestbook/?challenge=1")).json();
  for (const suffix of ["confirm=unknown", "challenge=1", "entry=0000000000000000", new URL(challenge.options[0].url).search.slice(1)]) {
    const r = await f.call(`/guestbook/?prepare=unknown&${suffix}`);
    assert.equal(r.status, 400);
  }
  assert.equal(f.writes.length, 0);
});

test("speculative and embedded fetches cannot submit", async () => {
  const f = fixture();
  const answer = await answerChallenge(f);
  const preview = await (await f.call(prepareUrl(answer))).json();
  const writes = f.writes.length;
  for (const headers of [{ purpose: "prefetch" }, { "sec-purpose": "prefetch;prerender" }, { "sec-fetch-dest": "image" }]) {
    assert.equal((await f.call(preview.confirmation_url, { headers })).status, 409);
  }
  assert.equal(f.writes.length, writes);
  assert.equal(f.values.has("gb"), false);
});

test("preview does not bypass submission limits or an unavailable safety circuit", async () => {
  const f = fixture();
  const answer = await answerChallenge(f);
  const preview = await (await f.call(prepareUrl(answer))).json();
  const key = `rl:${new Date().toISOString().slice(0, 10)}:write:0.0.0.0`;
  f.values.set(key, "100");
  assert.equal((await f.call(preview.confirmation_url)).status, 429);
  assert.equal(f.values.has("gb"), false);
  f.values.delete(key);
  delete f.env.GUESTBOOK_CIRCUIT;
  const url = new URL(preview.confirmation_url);
  url.searchParams.set("format", "html");
  const unavailable = await f.call(url);
  assert.equal(unavailable.status, 503);
  assert.match(await unavailable.text(), /safety circuit/);
  assert.equal(f.values.has("gb"), false);
});

test("final HTML submission retains burst protection", async () => {
  const f = fixture();
  const answer = await answerChallenge(f);
  const preview = await (await f.call(prepareUrl(answer))).json();
  f.env.GUESTBOOK_BURST.limit = async () => ({ success: false });
  const url = new URL(preview.confirmation_url);
  url.searchParams.set("format", "html");
  const r = await f.call(url);
  assert.equal(r.status, 429);
  assert.match(await r.text(), /Cloudflare burst protection/);
  assert.equal(f.values.has("gb"), false);
});

test("passed and flagged moderation preserve their publication behavior", async (t) => {
  for (const flagged of [false, true]) {
    const f = fixture();
    f.env.OPENAI_API_KEY = "local-mock-key";
    const moderation = t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(url, "https://api.openai.com/v1/moderations");
      return Response.json({ results: [{ flagged, categories: {} }] });
    });
    const answer = await answerChallenge(f);
    const preview = await (await f.call(prepareUrl(answer))).json();
    assert.equal(moderation.mock.callCount(), 0);
    const result = await (await f.call(preview.confirmation_url)).json();
    assert.equal(moderation.mock.callCount(), 1);
    assert.equal(result.status, flagged ? "pending" : "published");
    moderation.mock.restore();
  }
});
