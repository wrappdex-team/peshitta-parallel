import assert from "node:assert/strict";
import { test } from "node:test";

class MemoryStore {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
}
const session = new MemoryStore();
const local = new MemoryStore();
Object.assign(globalThis, { sessionStorage: session, localStorage: local });

const { detectProvider, keyFits, matrix, PROVIDERS, provider } = await import("./catalog.ts");
const vault = await import("./vault.ts");
const { testConnection } = await import("./connect.ts");
const { redact, failure } = await import("./http.ts");
const oauth = await import("./oauth.ts");

const fake = {
  google: "AQ." + "g".repeat(30),
  openai: "sk-proj-" + "o".repeat(30),
  anthropic: "sk-ant-api03-" + "a".repeat(30),
  xai: "xai-" + "x".repeat(30),
  openrouter: "sk-or-v1-" + "r".repeat(40),
  elevenlabs: "sk_" + "e".repeat(40),
  fal: "12345678-1234-1234-1234-123456789abc:" + "f".repeat(32),
};

test("pasted keys are recognised by provider without stealing each other", () => {
  for (const [id, key] of Object.entries(fake)) assert.equal(detectProvider(key), id, id);
  assert.equal(detectProvider(`  "Bearer ${fake.xai}" `), "xai");
  assert.equal(detectProvider("hello"), null);
  assert.equal(keyFits("stability", "sk-" + "s".repeat(40)), true);
  assert.equal(keyFits("openai", fake.anthropic), false);
});

test("capability matrix lights only what the connected accounts can do", () => {
  const m = matrix(["anthropic", "elevenlabs"]);
  assert.deepEqual(m.still, []);
  assert.deepEqual(m.song, ["elevenlabs"]);
  assert.deepEqual(m.director, ["anthropic"]);
  const all = matrix(PROVIDERS.map((p) => p.id));
  for (const cap of ["still", "song", "film", "voice", "director"] as const) assert.ok(all[cap].length > 0, cap);
  assert.equal(provider("anthropic").caps.still, undefined, "Claude makes no media");
  assert.deepEqual(provider("openai").caps.still?.map((m) => m.id).includes("gpt-image-1"), false, "gpt-image-1 was shut down");
});

test("vault keeps several connections in sessionStorage injeel-agent only", () => {
  vault.disconnectAll();
  assert.ok(vault.connect("google", fake.google));
  assert.ok(vault.connect("anthropic", ` ${fake.anthropic} `));
  assert.deepEqual(Object.keys(vault.connections()).sort(), ["anthropic", "google"]);
  assert.equal(vault.connections().anthropic, fake.anthropic);
  assert.deepEqual([...session.map.keys()], ["injeel-agent"]);
  assert.equal(local.map.size, 0, "never localStorage");
  vault.disconnect("google");
  assert.deepEqual(Object.keys(vault.connections()), ["anthropic"]);
  vault.disconnect("anthropic");
  assert.equal(session.map.size, 0, "empty vault removes the entry");
});

test("a classic single raw key is read as one connection; junk is ignored", () => {
  session.setItem("injeel-agent", fake.xai);
  assert.deepEqual(vault.connections(), { xai: fake.xai });
  session.setItem("injeel-agent", "{not json");
  assert.deepEqual(vault.connections(), {});
  session.setItem("injeel-agent", JSON.stringify({ v: 2, keys: { evil: "x", openai: fake.openai } }));
  assert.deepEqual(vault.connections(), { openai: fake.openai });
  vault.disconnectAll();
});

test("blocked storage never throws and reports failure", () => {
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.deepEqual(vault.readVault(blocked).keys, {});
  assert.equal(vault.connect("google", fake.google, blocked), false);
});

test("test connection uses one cheap read with the right auth header per provider", async () => {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string> });
    return new Response(JSON.stringify({ data: [{ id: "m1" }, { id: "m2" }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const ok = await testConnection("openai", fake.openai, fetcher);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.models.length, 2);
  assert.match(seen[0].url, /^https:\/\/api\.openai\.com\/v1\/models$/);
  assert.equal(seen[0].headers.Authorization, `Bearer ${fake.openai}`);
  await testConnection("google", fake.google, fetcher);
  assert.equal(seen[1].headers["x-goog-api-key"], fake.google);
  await testConnection("anthropic", fake.anthropic, fetcher);
  assert.equal(seen[2].headers["anthropic-dangerous-direct-browser-access"], "true");
  const falProbe = await testConnection("fal", fake.fal, fetcher);
  assert.equal(falProbe.ok, true);
  assert.equal(seen.length, 3, "fal makes no request");
});

test("provider failures are short, keyless, and safety refusals read calmly", async () => {
  const leak = new Response(JSON.stringify({ error: { message: `Incorrect API key provided: ${fake.openai}` } }), { status: 401 });
  const bad = await failure("OpenAI", leak, fake.openai);
  assert.ok(!bad.error.includes(fake.openai));
  assert.match(bad.error, /HTTP 401/);
  const safe = await failure("OpenAI", new Response(JSON.stringify({ error: { message: "Your request was rejected by the safety system", code: "moderation_blocked" } }), { status: 400 }));
  assert.equal(safe.safety, true);
  assert.match(safe.error, /declined this for safety/);
  assert.equal(redact(`k=${fake.fal} and ${fake.elevenlabs}`).includes("f".repeat(32)), false);
  const net = await testConnection("xai", fake.xai, (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch);
  assert.equal(net.ok, false);
});

test("OpenRouter PKCE: S256 challenge, verifier kept in the tab, code exchanged once", async () => {
  // RFC 7636 appendix B vector.
  assert.equal(await oauth.challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const url = new URL((await oauth.openRouterSignInUrl("https://www.injeel.news", "/read/matthew/5")) as string);
  assert.equal(url.origin + url.pathname, "https://openrouter.ai/auth");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("callback_url"), "https://www.injeel.news/connected");
  assert.ok(!url.search.includes(vault.readVault().pending?.verifier as string), "verifier never in the URL");
  let body: Record<string, string> = {};
  const fetcher = (async (u: string, init: RequestInit) => {
    assert.equal(u, "https://openrouter.ai/api/v1/auth/keys");
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ key: fake.openrouter }), { status: 200 });
  }) as unknown as typeof fetch;
  const verifier = vault.readVault().pending?.verifier;
  const done = await oauth.finishOpenRouterSignIn("auth_code_abc123", fetcher);
  assert.deepEqual(done, { ok: true, returnTo: "/read/matthew/5" });
  assert.equal(body.code_verifier, verifier);
  assert.equal(vault.connections().openrouter, fake.openrouter);
  assert.equal(vault.readVault().pending, undefined);
  const again = await oauth.finishOpenRouterSignIn("auth_code_abc123", fetcher);
  assert.equal(again.ok, false, "a code cannot be replayed without a fresh verifier");
  assert.equal(oauth.safeReturn("https://evil.example/"), "/");
  assert.equal(oauth.safeReturn("//evil.example"), "/");
  vault.disconnectAll();
});
