const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const structure = require('../../../../scripts/checks/tree/check-structure.js');

const CONFIG = {
  structure: {
    root: ['README.md', 'web', 'docs'],
    catchAllNames: ['utils', 'helpers'],
    pages: ['web/index.html'],
    loaded: { include: ['web/js/'], extensions: ['.js'] },
    fileStructure: 'docs/FILES.md',
    documented: { include: ['web/js/'], extensions: ['.js'] }
  }
};

/** Writes files under a new folder and returns it with their paths. */
function repo(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-structure-'));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return { root, files: Object.keys(files) };
}

const found = ({ root, files }) =>
  structure
    .check(root, files, CONFIG)
    .map((f) => `${f.file}:${f.line} ${f.rule}`);

test('Structure check: a tree that keeps every rule passes', () => {
  const tree = repo({
    'README.md': '',
    'web/index.html': '<script src="js/app.js"></script>\n',
    'web/js/app.js': '',
    'docs/FILES.md': '| `web/js/app.js` | The app. |'
  });
  assert.deepEqual(found(tree), []);
});

test('Structure check: each broken rule is found where it is', () => {
  const tree = repo({
    'notes.txt': '',
    'web/index.html':
      '<link href="https://x.org/a.css">\n<script src="js/gone.js">',
    'web/js/a.js': '',
    'web/js/b.js': '',
    'web/js/utils.js': '',
    'web/helpers/c.js': '',
    'docs/FILES.md': 'Names `a.js`, `b.js` and `utils.js`.'
  });
  assert.deepEqual(found(tree).sort(), [
    'notes.txt:0 structure/root',
    'web/helpers/:0 structure/name',
    'web/index.html:2 structure/pages',
    'web/js/a.js:0 structure/pages',
    'web/js/b.js:0 structure/pages',
    'web/js/utils.js:0 structure/name',
    'web/js/utils.js:0 structure/pages'
  ]);
});
