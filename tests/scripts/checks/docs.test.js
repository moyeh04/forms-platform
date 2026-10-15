const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const docs = require('../../../scripts/checks/check-docs.js');

const CONFIG = {
  docs: {
    api: 'docs/API.md',
    testing: 'docs/TESTING.md',
    tests: 'tests',
    backend: { include: ['backend/'], extensions: ['.gs', '.js'] }
  }
};

/** Writes a small repository and returns its root and file list. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-docs-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return { root, files: Object.keys(files) };
}

const TWO_TESTS =
  "const test = require('node:test');\ntest('a', () => {});\ntest('b', () => {});\n";

const good = () => ({
  'backend/Forms.gs':
    "API['admin.forms.list'] = function () {};\nAPI.submit = function () {};\n",
  'docs/API.md':
    '| `admin.forms.list` | yes |\n| `submit` | no |\n[Testing](TESTING.md)\n',
  'docs/TESTING.md':
    '2 automated tests\n\n| Forms | `forms.test.js` | 2 | Lists |\n',
  'tests/forms.test.js': TWO_TESTS
});

test('Docs check: a matching API page, test page and links pass', () => {
  const { root, files } = repo(good());
  assert.deepEqual(docs.check(root, files, CONFIG), []);
});

test('Docs check: a missing action, a wrong count and a broken link are each found', () => {
  const files = good();
  files['backend/Forms.gs'] += "API['admin.forms.delete'] = function () {};\n";
  files['tests/sub/more.test.js'] = TWO_TESTS;
  files['docs/API.md'] += '[Gone](OLD.md)\n';
  const { root, files: list } = repo(files);
  const found = docs
    .check(root, list, CONFIG)
    .map((f) => `${f.file}: ${f.message}`);
  assert.deepEqual(found, [
    'docs/API.md: no row for admin.forms.delete',
    'docs/TESTING.md: gives 2 tests in total; there are 4',
    'docs/TESTING.md: no row for sub/more.test.js (2 tests)',
    'docs/API.md: links to OLD.md, which does not exist'
  ]);
});
