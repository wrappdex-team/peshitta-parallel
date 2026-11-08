import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
const agent = {};
runInNewContext(compile("src/lib/agent.ts"), { exports: agent });
const studio = compile("src/components/studio.tsx");
const dummy = `xai-${"synthetic-storage-fixture-".repeat(2)}`;

// Component event/effect harness only: never browser storage, real keys or providers.
const storageSource = compile("src/lib/provider-key-storage.ts");
function fixture({ local = new Map(), session = new Map(), deny = {} } = {}) {
  const states = [];
  const dependencies = [];
  let stateIndex = 0;
  let effectIndex = 0;
  let effects = [];
  let dirty = false;
  const calls = [];
  function storage(name, store) {
    const record = (op, key) => {
      calls.push([name, op, key]);
      if (deny[`${name}:${op}`]) throw new Error("synthetic storage denial");
    };
    return {
      getItem(key) {
        record("get", key);
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        record("set", key);
        store.set(key, value);
      },
      removeItem(key) {
        record("remove", key);
        store.delete(key);
      },
      clear() {
        record("clear");
        throw new Error("Broad storage clear is forbidden");
      },
    };
  }
  const objects = { local: storage("local", local), session: storage("session", session) };
  function context(exports, require) {
    const value = { exports, require };
    for (const name of ["local", "session"]) {
      Object.defineProperty(value, `${name}Storage`, {
        get() {
          if (deny[`${name}:access`]) {
            calls.push([name, "access"]);
            throw new Error("synthetic accessor denial");
          }
          return objects[name];
        },
      });
    }
    return value;
  }
  const keyStorage = {};
  runInNewContext(
    storageSource,
    context(keyStorage, (name) => {
      assert.equal(name, "@/lib/agent");
      return agent;
    }),
  );
  const hooks = {
    useState(initial) {
      const slot = stateIndex++;
      if (slot >= states.length) states[slot] = initial;
      return [
        states[slot],
        (next) => {
          const value = typeof next === "function" ? next(states[slot]) : next;
          if (value !== states[slot]) {
            states[slot] = value;
            dirty = true;
          }
        },
      ];
    },
    useEffect(effect, deps) {
      const slot = effectIndex++;
      if (!dependencies[slot] || deps.some((value, i) => !Object.is(value, dependencies[slot][i])))
        effects.push(effect);
      dependencies[slot] = deps;
    },
  };
  const exports = {};
  runInNewContext(
    studio,
    context(exports, (name) => {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "@/lib/agent") return agent;
      if (name === "@/lib/provider-key-storage") return keyStorage;
      if (name === "@/lib/studio")
        return new Proxy(
          {},
          {
            get() {
              return () => {
                throw new Error("No provider action may run in storage tests");
              };
            },
          },
        );
      throw new Error(`Unexpected storage-test import: ${name}`);
    }),
  );
  return {
    local,
    session,
    calls,
    assertPolicy() {
      assert.ok(
        !calls.some(
          ([name, op, key]) =>
            name === "local" && key === agent.AGENT_STORE && (op === "get" || op === "set"),
        ),
        "never read/write a persistent provider key",
      );
      assert.ok(!calls.some(([, op]) => op === "clear"), "never broadly clear storage");
    },
    render(open = true) {
      for (let i = 0; i < 8; i++) {
        stateIndex = effectIndex = 0;
        effects = [];
        dirty = false;
        const tree = exports.Studio({ open, passage: "synthetic fixture passage", onClose() {} });
        for (const effect of effects) effect();
        if (!dirty) return tree;
      }
      throw new Error("Synthetic component did not settle");
    },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== "object") return;
  if (Array.isArray(tree)) return tree.map((child) => find(child, predicate)).find(Boolean);
  if (predicate(tree)) return tree;
  return find(tree.props?.children, predicate);
}
const input = (tree) =>
  find(tree, (node) => node.type === "input" && node.props.type === "password");
const button = (tree, label) =>
  find(tree, (node) => node.type === "button" && node.props.children === label);

test("Studio restores only the tab's dummy key and cleans the exact legacy entry unread", () => {
  const page = fixture({
    session: new Map([[agent.AGENT_STORE, dummy]]),
    local: new Map([
      [agent.AGENT_STORE, "old-synthetic-key"],
      ["progress-fixture", "preserve"],
    ]),
  });
  const tree = page.render();
  assert.equal(page.session.get(agent.AGENT_STORE), dummy);
  assert.equal(page.local.has(agent.AGENT_STORE), false);
  assert.equal(page.local.get("progress-fixture"), "preserve");
  assert.equal(input(tree).props.value, "");
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /xAI key saved for this tab/);
  assert.ok(!markup.includes(dummy));
  assert.ok(!markup.includes("old-synthetic-key"));
  assert.match(markup, /restore or tab duplication may preserve or copy/);
  assert.match(markup, /not secure erasure or XSS protection/);
  page.assertPolicy();
});

test("legacy persistent keys are discarded, never silently copied or used", () => {
  const page = fixture({ local: new Map([[agent.AGENT_STORE, dummy]]) });
  const tree = page.render();
  assert.match(renderToStaticMarkup(tree), /YOUR PROVIDER KEY REQUIRED/);
  assert.equal(page.local.has(agent.AGENT_STORE), false);
  assert.equal(page.session.has(agent.AGENT_STORE), false);
  assert.ok(!page.calls.some(([name, op]) => name === "session" && op === "set"));
  page.assertPolicy();
});

test("Save, same-tab refresh and Clear use only dummy session storage", () => {
  const local = new Map([["unrelated-fixture", "preserve"]]);
  const session = new Map();
  const page = fixture({ local, session });
  let tree = page.render();
  input(tree).props.onChange({ target: { value: `  ${dummy}  ` } });
  tree = page.render();
  assert.equal(button(tree, "Save").props.disabled, false);
  button(tree, "Save").props.onClick();
  tree = page.render();
  assert.equal(session.get(agent.AGENT_STORE), dummy);
  assert.equal(local.has(agent.AGENT_STORE), false);
  assert.equal(input(tree).props.value, "");
  const refreshed = fixture({ local, session });
  tree = refreshed.render();
  assert.match(renderToStaticMarkup(tree), /xAI key saved for this tab/);
  button(tree, "Clear").props.onClick();
  tree = refreshed.render();
  assert.equal(session.has(agent.AGENT_STORE), false);
  assert.equal(local.get("unrelated-fixture"), "preserve");
  assert.match(renderToStaticMarkup(tree), /YOUR PROVIDER KEY REQUIRED/);
  assert.match(
    renderToStaticMarkup(fixture({ local, session: new Map() }).render()),
    /YOUR PROVIDER KEY REQUIRED/,
  );
  page.assertPolicy();
  refreshed.assertPolicy();
});

test("denied session reads disconnect without using a legacy persistent fallback", () => {
  const page = fixture({
    local: new Map([[agent.AGENT_STORE, dummy]]),
    session: new Map([[agent.AGENT_STORE, dummy]]),
    deny: { "session:get": true },
  });
  const markup = renderToStaticMarkup(page.render());
  assert.match(markup, /YOUR PROVIDER KEY REQUIRED/);
  assert.match(markup, /Session storage is unavailable/);
  assert.ok(!markup.includes(dummy));
  page.assertPolicy();
});

test("denied session writes do not activate a key or fall back to persistent storage", () => {
  for (const blockedRemoval of [false, true]) {
    const previous = `xai-${"old-session-fixture-".repeat(2)}`;
    const page = fixture({
      session: new Map([[agent.AGENT_STORE, previous]]),
      deny: { "session:set": true, "session:remove": blockedRemoval },
    });
    let tree = page.render();
    input(tree).props.onChange({ target: { value: dummy } });
    tree = page.render();
    button(tree, "Save").props.onClick();
    const markup = renderToStaticMarkup(page.render());
    assert.match(markup, /YOUR PROVIDER KEY REQUIRED/);
    assert.match(markup, /could not be saved for this tab/);
    assert.equal(page.session.has(agent.AGENT_STORE), blockedRemoval);
    assert.equal(page.local.has(agent.AGENT_STORE), false);
    if (blockedRemoval) {
      assert.equal(page.session.get(agent.AGENT_STORE), previous);
      assert.match(markup, /previous session key; it may return after refresh/);
    }
    page.assertPolicy();
  }
});

test("blocked Clear disconnects in memory and honestly warns a key can return", () => {
  const page = fixture({
    session: new Map([[agent.AGENT_STORE, dummy]]),
    deny: { "session:remove": true },
  });
  const tree = page.render();
  button(tree, "Clear").props.onClick();
  const markup = renderToStaticMarkup(page.render());
  assert.match(markup, /YOUR PROVIDER KEY REQUIRED/);
  assert.match(markup, /blocked removal of the session key/);
  assert.match(markup, /may return after refresh/);
  assert.equal(page.session.get(agent.AGENT_STORE), dummy);
  page.assertPolicy();
});

test("denied storage accessors or legacy cleanup do not crash Studio or silently copy old keys", () => {
  for (const deny of [
    { "local:access": true },
    { "local:remove": true },
    { "session:access": true, "local:access": true },
  ]) {
    const page = fixture({
      local: new Map([
        [agent.AGENT_STORE, dummy],
        ["progress-fixture", "preserve"],
      ]),
      deny,
    });
    const markup = renderToStaticMarkup(page.render());
    assert.match(markup, /YOUR PROVIDER KEY REQUIRED/);
    assert.match(markup, /blocked removal of an old device-saved provider key/);
    assert.equal(page.local.get("progress-fixture"), "preserve");
    assert.equal(page.session.has(agent.AGENT_STORE), false);
    page.assertPolicy();
  }
});

test("closed Studio mount cleans the legacy key without retaining an active in-memory credential", () => {
  const page = fixture({ local: new Map([[agent.AGENT_STORE, dummy]]) });
  assert.equal(page.render(false), null);
  assert.equal(page.local.has(agent.AGENT_STORE), false);
  assert.match(renderToStaticMarkup(page.render(true)), /YOUR PROVIDER KEY REQUIRED/);
  page.assertPolicy();
});
