import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/credential-cache-scope.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function fixture() {
  const exports = {};
  let seeds = 0;
  runInNewContext(compiled, {
    exports,
    TextEncoder,
    crypto: {
      subtle: {
        async generateKey(algorithm, extractable, usages) {
          assert.equal(algorithm.name, "HMAC");
          assert.equal(algorithm.hash, "SHA-256");
          assert.equal(algorithm.length, 256);
          assert.equal(extractable, false);
          assert.equal(usages.join(","), "sign");
          return webcrypto.subtle.importKey(
            "raw",
            Buffer.alloc(32, ++seeds),
            algorithm,
            extractable,
            usages,
          );
        },
        sign: webcrypto.subtle.sign.bind(webcrypto.subtle),
      },
    },
  });
  return { ...exports, seeds: () => seeds };
}
const agent = { kind: "xai", key: `xai-${"synthetic-fixture-".repeat(3)}` };

test("cache scope is an HMAC of provider plus credential, not a reversible key encoding", async () => {
  const f = fixture();
  assert.equal(f.seeds(), 0);
  const scope = f.createCredentialCacheScope();
  assert.equal(f.seeds(), 0, "factory creation has no entropy side effects");
  const digest = await scope(agent);
  assert.equal(
    digest,
    createHmac("sha256", Buffer.alloc(32, 1))
      .update(JSON.stringify([agent.kind, agent.key]), "utf8")
      .digest("hex"),
  );
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.ok(!digest.includes(agent.key));
  assert.notEqual(digest, Buffer.from(agent.key).toString("base64"));
  assert.notEqual(await scope({ ...agent, kind: "openai" }), digest);
  assert.notEqual(await scope({ ...agent, key: agent.key + "other" }), digest);
  assert.equal(f.seeds(), 1);
});

test("concurrent same-credential requests use one private seed and one stable scope", async () => {
  const f = fixture();
  const scope = f.createCredentialCacheScope();
  const digests = await Promise.all(Array.from({ length: 100 }, () => scope(agent)));
  assert.equal(new Set(digests).size, 1);
  assert.equal(f.seeds(), 1);
  const otherInstance = f.createCredentialCacheScope();
  assert.notEqual(await otherInstance(agent), digests[0]);
  assert.equal(f.seeds(), 2, "fresh cache instance uses a new private seed");
});

test("native Web Crypto generation/signing works without environment credentials", async () => {
  const exports = {};
  runInNewContext(compiled, { exports, crypto: webcrypto, TextEncoder });
  const scope = exports.createCredentialCacheScope();
  const digest = await scope(agent);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(await scope(agent), digest);
  assert.notEqual(await scope({ ...agent, key: agent.key + "other" }), digest);
});
