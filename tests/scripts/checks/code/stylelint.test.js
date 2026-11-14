const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const stylelint = require("../../../../scripts/checks/code/check-stylelint.js");

const CONFIG = { stylelint: { include: ["css/"], extensions: [".css"] } };

/** Writes a small repository with its own Stylelint config and returns its root. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-stylelint-"));
  const settings = 'export default { rules: { "property-disallowed-list": ["margin-left"] } };\n';
  fs.writeFileSync(path.join(root, "stylelint.config.mjs"), settings);
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

test("Stylelint check: a clean stylesheet, or none in the run, has no findings", () => {
  const root = repo({ "css/ok.css": "a {\n  margin-inline-start: 0;\n}\n" });
  assert.deepEqual(stylelint.check(root, ["css/ok.css"], CONFIG), []);
  assert.deepEqual(stylelint.check(root, ["web/app.js"], CONFIG), []);
});

test("Stylelint check: a refused property becomes a finding with its line", () => {
  const root = repo({
    "css/side.css": "a {\n  color: red;\n  margin-left: 0;\n}\n",
    "other/skip.css": "a {\n  margin-left: 0;\n}\n",
  });
  const found = stylelint
    .check(root, ["css/side.css", "other/skip.css"], CONFIG)
    .map((f) => `${f.file}:${f.line} ${f.rule}`);
  assert.deepEqual(found, ["css/side.css:3 stylelint/property-disallowed-list"]);
});
