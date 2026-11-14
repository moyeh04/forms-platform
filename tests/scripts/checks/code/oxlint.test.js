const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const oxlint = require("../../../../scripts/checks/code/check-oxlint.js");

const CONFIG = { oxlint: { include: ["src/"], extensions: [".js"] }, run: { staged: true } };

/** Writes a small repository with its own .oxlintrc.json and returns its root. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-oxlint-"));
  const settings = { categories: { correctness: "error" }, rules: { "no-debugger": "error" } };
  fs.writeFileSync(path.join(root, ".oxlintrc.json"), JSON.stringify(settings));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

test("Oxlint check: a clean file has no findings", () => {
  const root = repo({ "src/ok.js": "module.exports = { a: 1 };\n" });
  assert.deepEqual(oxlint.check(root, ["src/ok.js"], CONFIG), []);
});

test("Oxlint check: a lint rule becomes a finding with its line", () => {
  const root = repo({
    "src/lint.js": "const a = 1;\ndebugger;\nmodule.exports = a;\n",
    "other/skip.js": "debugger;\n",
  });
  const files = ["src/lint.js", "other/skip.js"];
  const found = oxlint.check(root, files, CONFIG).map((f) => `${f.file}:${f.line} ${f.rule}`);
  assert.deepEqual(found, ["src/lint.js:2 oxlint/eslint/no-debugger"]);
});
