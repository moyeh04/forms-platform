const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PAGES, sourceOf } = require('../../../scripts/build/site-map.js');

const root = path.resolve(__dirname, '..', '..', '..');

test('Site map: each published path finds its source file', () => {
  assert.equal(sourceOf('index.html'), 'web/index.html');
  assert.equal(sourceOf('/admin.html?x=1#y'), 'web/admin.html');
  assert.equal(sourceOf('assets/js/api.js?v=abc'), 'web/js/api.js');
  assert.equal(sourceOf('/assets/css/theme.css'), 'web/css/theme.css');
  assert.equal(sourceOf('assets/img/ship.svg'), 'web/img/ship.svg');
  assert.equal(sourceOf('shared/rules/index.js'), 'domain/rules/index.js');
  for (const page of PAGES) {
    assert.ok(fs.existsSync(path.join(root, sourceOf(page))), page);
  }
});

test('Site map: paths outside the site, or leaving it, have no source', () => {
  assert.equal(sourceOf('README.md'), null);
  assert.equal(sourceOf('backend/main.js'), null);
  assert.equal(sourceOf('/assets/js/../../../package.json'), null);
  assert.equal(sourceOf('/.git/config'), null);
});

test('Site map: every rules loader reads the parts in one order', () => {
  const { JOINED } = require('../../../scripts/build/site-map.js');
  const { bundleSource } = require('../../../scripts/build/bundle-backend.js');
  const parts = JOINED.find((j) => j.published === 'shared/rules.js').sources;
  for (const page of ['web/index.html', 'web/admin.html']) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    const loaded = [
      ...html.matchAll(/<script src="(shared\/rules\/[^"]+)"/g)
    ].map((m) => sourceOf(m[1]));
    assert.deepEqual(loaded, parts, page);
  }
  const bundled = bundleSource().files.filter((f) =>
    f.startsWith('domain/rules/')
  );
  assert.deepEqual(bundled, parts, 'bundle');
});
