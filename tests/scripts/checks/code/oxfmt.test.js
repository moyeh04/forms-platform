const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const oxfmt = require("../../../../scripts/checks/code/check-oxfmt.js");

const CONFIG = { oxfmt: { include: ["src/"], extensions: [".js"] } };

/** Writes a small repository with its own .oxfmtrc.json and returns its root. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-oxfmt-"));
  fs.writeFileSync(path.join(root, ".oxfmtrc.json"), "{}\n");
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

test("Oxfmt check: a laid-out file, or none in the run, has no findings", () => {
  const root = repo({ "src/ok.js": 'module.exports = { a: "b" };\n' });
  assert.deepEqual(oxfmt.check(root, ["src/ok.js"], CONFIG), []);
  assert.deepEqual(oxfmt.check(root, ["web/app.css"], CONFIG), []);
});

test("Oxfmt check: a file it would change becomes a finding", () => {
  const root = repo({ "src/messy.js": "module.exports={a:'b'}\n", "other/skip.js": "x=1\n" });
  const found = oxfmt
    .check(root, ["src/messy.js", "other/skip.js"], CONFIG)
    .map((f) => `${f.file} ${f.rule}`);
  assert.deepEqual(found, ["src/messy.js oxfmt"]);
});
