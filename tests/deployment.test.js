const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { apiUrl, buildSite } = require('../scripts/build-site.js');
const { deploymentConfig, prepareClasp } = require('../scripts/prepare-clasp.js');

const root = path.resolve(__dirname, '..');
const env = {
  API_URL: 'https://script.google.com/macros/s/test-deployment/exec',
  APPS_SCRIPT_DEPLOYMENT_ID: 'test-deployment',
  APPS_SCRIPT_ID: 'test-script',
  CLASPRC_JSON: JSON.stringify({ tokens: { default: { refresh_token: 'test-only' } } })
};

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forms-deployment-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('Deployment: missing or malformed API_URL cannot produce a site artifact', (t) => {
  const output = path.join(temp(t), 'site');
  for (const value of ['', 'PASTE_YOUR_WEB_APP_URL_HERE', 'https://example.com/exec',
    'http://script.google.com/macros/s/test/exec', env.API_URL + '?key=bad',
    env.API_URL.replace('/exec', '/dev'), env.API_URL + "';alert(1)"]) {
    assert.throws(() => buildSite({ API_URL: value }, output), /API_URL/);
    assert.equal(fs.existsSync(output), false);
  }
});

test('Deployment: API_URL must match the deployment being updated', () => {
  assert.equal(apiUrl(env), env.API_URL);
  assert.throws(() => apiUrl({ ...env, APPS_SCRIPT_DEPLOYMENT_ID: 'different' }), /same deployment/);
});

test('Deployment: built admin, student and viewer pages use the variable URL', async (t) => {
  const output = path.join(temp(t), 'site');
  const sourceConfig = fs.readFileSync(path.join(root, 'assets/js/config.js'), 'utf8');
  buildSite(env, output);
  fs.writeFileSync(path.join(output, 'private-marker'), 'must not be published');
  buildSite(env, output);
  assert.equal(fs.existsSync(path.join(output, 'private-marker')), false);
  assert.deepEqual(fs.readdirSync(output).sort(),
    ['.nojekyll', 'admin.html', 'assets', 'index.html', 'shared', 'viewer.html']);
  for (const page of ['admin.html', 'index.html', 'viewer.html']) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    for (const match of html.matchAll(/<script src="([^"]+)"><\/script>/g)) {
      assert.equal(fs.existsSync(path.join(output, match[1])), true, page + ': ' + match[1]);
    }
  }
  const config = fs.readFileSync(path.join(output, 'assets/js/config.js'), 'utf8');
  assert.equal(config.includes('PASTE_'), false);
  assert.equal(config.includes('test-only'), false);
  let calledUrl;
  const window = { sessionStorage: { getItem: () => '', setItem: () => {} } };
  const context = vm.createContext({ window, fetch: async (url) => {
    calledUrl = url;
    return { json: async () => ({ ok: true }) };
  } });
  vm.runInContext(config, context);
  vm.runInContext(fs.readFileSync(path.join(output, 'assets/js/api.js'), 'utf8'), context);
  await window.App.api.admin('admin.forms.list');
  assert.equal(calledUrl, env.API_URL);
  await window.App.api.call({ action: 'getForm', slug: 'test' });
  assert.equal(calledUrl, env.API_URL);
  await window.App.api.viewer('viewer.data', 'test-token');
  assert.equal(calledUrl, env.API_URL);
  assert.equal(fs.readFileSync(path.join(root, 'assets/js/config.js'), 'utf8'), sourceConfig);
});

test('Deployment: absent IDs or credentials are explicit failures without exposing tokens', () => {
  for (const key of ['APPS_SCRIPT_ID', 'APPS_SCRIPT_DEPLOYMENT_ID', 'CLASPRC_JSON']) {
    assert.throws(() => deploymentConfig({ ...env, [key]: '' }), new RegExp(key));
  }
  for (const credentials of ['bad-secret-test-only', 'null', '[]', '{}']) {
    assert.throws(() => deploymentConfig({ ...env, CLASPRC_JSON: credentials }),
      (error) => error.message.includes('CLASPRC_JSON') && !error.message.includes('test-only'));
  }
});

test('Deployment: clasp targets dist and writes private credentials separately', (t) => {
  const dir = temp(t);
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  prepareClasp(env, dir, home);
  const project = JSON.parse(fs.readFileSync(path.join(dir, '.clasp.json'), 'utf8'));
  assert.deepEqual(project, { scriptId: env.APPS_SCRIPT_ID, rootDir: './dist' });
  const auth = path.join(home, '.clasprc.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(auth, 'utf8')), JSON.parse(env.CLASPRC_JSON));
  assert.equal(fs.statSync(auth).mode & 0o777, 0o600);
});

test('Deployment: command line returns failure when API_URL is missing', () => {
  const result = spawnSync(process.execPath, ['scripts/build-site.js'], {
    cwd: root, env: { ...process.env, API_URL: '' }, encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /API_URL/);
});
