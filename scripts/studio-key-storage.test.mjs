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
function fixture(store = new Map()) {
  const states = [];
  const dependencies = [];
  let stateIndex = 0;
  let effectIndex = 0;
  let effects = [];
  let dirty = false;
  const calls = [];
  const storage = {
    getItem(key) {
      calls.push(["get", key]);
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      calls.push(["set", key]);
      store.set(key, value);
    },
    removeItem(key) {
      calls.push(["remove", key]);
      store.delete(key);
    },
  };
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
  runInNewContext(studio, {
    exports,
    localStorage: storage,
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name === "@/lib/agent") return agent;
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
    },
  });
  return {
    store,
    calls,
    render() {
      for (let i = 0; i < 8; i++) {
        stateIndex = effectIndex = 0;
        effects = [];
        dirty = false;
        const tree = exports.Studio({
          open: true,
          passage: "synthetic fixture passage",
          onClose() {},
        });
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

test("Studio restores a raw saved dummy key without putting it into markup/password input", () => {
  const page = fixture(new Map([[agent.AGENT_STORE, dummy]]));
  const tree = page.render();
  assert.equal(
    page.store.get(agent.AGENT_STORE),
    dummy,
    "source intentionally retains raw persistent credential",
  );
  assert.equal(input(tree).props.value, "");
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /xAI key saved/);
  assert.ok(!markup.includes(dummy));
  assert.ok(page.calls.some(([op, key]) => op === "get" && key === agent.AGENT_STORE));
});

test("Save/reload/Clear affect only fake storage; persistence policy remains unchanged", () => {
  const store = new Map([["unrelated-fixture", "preserve"]]);
  const page = fixture(store);
  let tree = page.render();
  input(tree).props.onChange({ target: { value: `  ${dummy}  ` } });
  tree = page.render();
  assert.equal(button(tree, "Save").props.disabled, false);
  button(tree, "Save").props.onClick();
  tree = page.render();
  assert.equal(store.get(agent.AGENT_STORE), dummy);
  assert.equal(input(tree).props.value, "");
  const reloaded = fixture(store);
  tree = reloaded.render();
  assert.match(renderToStaticMarkup(tree), /xAI key saved/);
  button(tree, "Clear").props.onClick();
  tree = reloaded.render();
  assert.equal(store.has(agent.AGENT_STORE), false);
  assert.equal(store.get("unrelated-fixture"), "preserve");
  assert.match(renderToStaticMarkup(tree), /YOUR PROVIDER KEY REQUIRED/);
});
