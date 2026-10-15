const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const lines = require('../../../../scripts/checks/code/check-lines.js');

const CONFIG = {
  lines: {
    limit: 10,
    byExtension: { '.css': 12 },
    include: ['src/'],
    extensions: ['.js', '.css', ''],
    exclude: ['src/skip/']
  }
};

/** Writes files under a new folder and returns it. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-lines-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

test('Line check: a line over the limit is found, one at it passes', () => {
  const root = repo({
    'src/a.js': '1234567890\n12345678901\n',
    'src/hook': '12345678901\n'
  });
  const found = lines.check(root, ['src/a.js', 'src/hook'], CONFIG);
  assert.deepEqual(
    found.map((f) => `${f.file}:${f.line} ${f.message}`),
    [
      'src/a.js:2 11 columns; the limit is 10',
      'src/hook:1 11 columns; the limit is 10'
    ]
  );
});

test('Line check: an extension with its own width uses it', () => {
  const root = repo({ 'src/e.css': '123456789012\n1234567890123\n' });
  assert.deepEqual(
    lines
      .check(root, ['src/e.css'], CONFIG)
      .map((f) => f.line + ' ' + f.message),
    ['2 13 columns; the limit is 12']
  );
});

test('Line check: Arabic by character, URLs free, other folders out', () => {
  const root = repo({
    'src/b.js': 'أحمد محمد\n// https://example.com/a/very/long/path\n',
    'src/skip/c.js': '12345678901\n',
    'other/d.js': '12345678901\n'
  });
  assert.deepEqual(
    lines.check(root, ['src/b.js', 'src/skip/c.js', 'other/d.js'], CONFIG),
    []
  );
});
