const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const biome = require('../../../../scripts/checks/code/check-biome.js');

const CONFIG = { biome: { include: ['src/'], extensions: ['.js'] } };

/** Writes a small repository with its own biome.json and returns its root. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-biome-'));
  const settings = { formatter: { indentStyle: 'space', indentWidth: 2 } };
  fs.writeFileSync(path.join(root, 'biome.json'), JSON.stringify(settings));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}

test('Biome check: a formatted, clean file has no findings', () => {
  const root = repo({ 'src/ok.js': 'module.exports = { a: 1 };\n' });
  assert.deepEqual(biome.check(root, ['src/ok.js'], CONFIG), []);
});

test('Biome check: layout and lint problems become findings', () => {
  const root = repo({
    'src/bad.js': 'module.exports   =  {a:1}\n',
    'src/lint.js': 'debugger;\n',
    'other/skip.js': 'debugger;\n'
  });
  const files = ['src/bad.js', 'src/lint.js', 'other/skip.js'];
  const found = biome
    .check(root, files, CONFIG)
    .map((f) => `${f.file}:${f.line} ${f.rule}`);
  assert.deepEqual(found.sort(), [
    'src/bad.js:0 biome/format',
    'src/lint.js:1 biome/lint/suspicious/noDebugger'
  ]);
});
