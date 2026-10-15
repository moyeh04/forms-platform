const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { apiUrl, buildSite } = require('../../../scripts/build/build-site.js');

const root = path.resolve(__dirname, '..', '..', '..');
const env = {
  API_URL: 'https://script.google.com/macros/s/test-deployment/exec',
  APPS_SCRIPT_DEPLOYMENT_ID: 'test-deployment',
  APPS_SCRIPT_ID: 'test-script',
  CLASPRC_JSON: JSON.stringify({
    tokens: { default: { refresh_token: 'test-only' } }
  })
};

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forms-deployment-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('Deployment: missing or malformed API_URL cannot produce a site artifact', (t) => {
  const output = path.join(temp(t), 'site');
  for (const value of [
    '',
    'PASTE_YOUR_WEB_APP_URL_HERE',
    'https://example.com/exec',
    'http://script.google.com/macros/s/test/exec',
    env.API_URL + '?key=bad',
    env.API_URL.replace('/exec', '/dev'),
    env.API_URL + "';alert(1)"
  ]) {
    assert.throws(() => buildSite({ API_URL: value }, output), /API_URL/);
    assert.equal(fs.existsSync(output), false);
  }
});

test('Deployment: API_URL must match the deployment being updated', () => {
  assert.equal(apiUrl(env), env.API_URL);
  assert.throws(
    () => apiUrl({ ...env, APPS_SCRIPT_DEPLOYMENT_ID: 'different' }),
    /same deployment/
  );
});

test('Deployment: built admin, student and viewer pages use the variable URL', async (t) => {
  const output = path.join(temp(t), 'site');
  const sourceConfig = fs.readFileSync(
    path.join(root, 'web/js/config.js'),
    'utf8'
  );
  buildSite(env, output);
  fs.writeFileSync(
    path.join(output, 'private-marker'),
    'must not be published'
  );
  buildSite(env, output);
  assert.equal(fs.existsSync(path.join(output, 'private-marker')), false);
  assert.deepEqual(fs.readdirSync(output).sort(), [
    '.nojekyll',
    'admin.html',
    'assets',
    'index.html',
    'shared',
    'version.json',
    'viewer.html'
  ]);
  for (const page of ['admin.html', 'index.html', 'viewer.html']) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    for (const match of html.matchAll(
      /<script src="([^"?]+)[^"]*"><\/script>/g
    )) {
      assert.equal(
        fs.existsSync(path.join(output, match[1])),
        true,
        page + ': ' + match[1]
      );
    }
  }
  const config = fs.readFileSync(
    path.join(output, 'assets/js/config.js'),
    'utf8'
  );
  assert.equal(config.includes('PASTE_'), false);
  assert.equal(config.includes('test-only'), false);
  let calledUrl;
  const window = { sessionStorage: { getItem: () => '', setItem: () => {} } };
  const context = vm.createContext({
    window,
    fetch: async (url) => {
      calledUrl = url;
      return { json: async () => ({ ok: true }) };
    }
  });
  vm.runInContext(config, context);
  vm.runInContext(
    fs.readFileSync(path.join(output, 'assets/js/api.js'), 'utf8'),
    context
  );
  await window.App.api.admin('admin.forms.list');
  assert.equal(calledUrl, env.API_URL);
  await window.App.api.call({ action: 'getForm', slug: 'test' });
  assert.equal(calledUrl, env.API_URL);
  await window.App.api.viewer('viewer.data', 'test-token');
  assert.equal(calledUrl, env.API_URL);
  assert.equal(
    fs.readFileSync(path.join(root, 'web/js/config.js'), 'utf8'),
    sourceConfig
  );
});

test('Deployment: the built site carries its version, and a script or stylesheet address changes with its file', (t) => {
  const dir = temp(t);
  const output = buildSite(env, path.join(dir, 'site'));
  const version = JSON.parse(
    fs.readFileSync(path.join(output, 'version.json'), 'utf8')
  ).version;
  assert.match(version, /^[0-9a-f]{12}$/);
  const window = {};
  vm.runInContext(
    fs.readFileSync(path.join(output, 'assets/js/config.js'), 'utf8'),
    vm.createContext({ window })
  );
  assert.equal(
    window.APP_CONFIG.VERSION,
    version,
    'a page knows the version it was built as'
  );

  const print = (file) =>
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(output, file)))
      .digest('hex')
      .slice(0, 12);
  for (const page of ['admin.html', 'index.html', 'viewer.html']) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    const local = [
      ...html.matchAll(
        /<(?:script src|link rel="stylesheet" href)="((?:assets|shared)\/[^"]+)"/g
      )
    ].map((m) => m[1]);
    assert.ok(local.length >= 6, page + ' names its files');
    for (const address of local) {
      const [file, stamp] = address.split('?v=');
      assert.equal(
        stamp,
        print(file),
        page + ': ' + file + ' is named with the fingerprint of its content'
      );
    }
    assert.ok(
      local.some((a) => a.startsWith('assets/js/fresh.js?v=')),
      page + ' watches for a newer site'
    );
    assert.equal(
      fs.readFileSync(path.join(root, 'web', page), 'utf8').includes('?v='),
      false,
      'the source page is not stamped'
    );
  }

  // A page kept from before a script was split still finds the old address.
  const { JOINED } = require('../../../scripts/build/site-map.js');
  for (const { published, sources } of JOINED) {
    assert.equal(
      fs.readFileSync(path.join(output, published), 'utf8'),
      sources
        .map((source) => fs.readFileSync(path.join(root, source), 'utf8'))
        .join('\n'),
      published + ' joins its parts'
    );
  }

  // The same files give the same version, so a push that changes nothing a visitor loads reloads nobody.
  const again = buildSite(env, path.join(dir, 'again'));
  assert.equal(
    fs.readFileSync(path.join(again, 'version.json'), 'utf8'),
    fs.readFileSync(path.join(output, 'version.json'), 'utf8')
  );
  const moved = buildSite(
    { API_URL: env.API_URL.replace('test-deployment', 'other-deployment') },
    path.join(dir, 'moved')
  );
  assert.notEqual(
    JSON.parse(fs.readFileSync(path.join(moved, 'version.json'), 'utf8'))
      .version,
    version,
    'a new backend address is a new version'
  );
});

test('Deployment: command line returns failure when API_URL is missing', () => {
  const result = spawnSync(process.execPath, ['scripts/build/build-site.js'], {
    cwd: root,
    env: { ...process.env, API_URL: '' },
    encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /API_URL/);
});
