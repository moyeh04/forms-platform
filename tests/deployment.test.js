const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const { apiUrl, buildSite } = require('../scripts/build-site.js');
const { deploymentConfig, prepareClasp } = require('../scripts/prepare-clasp.js');
const { CLASP, createdProject, deploymentId, setup } = require('../scripts/setup-deployment.js');

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
    ['.nojekyll', 'admin.html', 'assets', 'index.html', 'shared', 'version.json', 'viewer.html']);
  for (const page of ['admin.html', 'index.html', 'viewer.html']) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    for (const match of html.matchAll(/<script src="([^"?]+)[^"]*"><\/script>/g)) {
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

test('Deployment: the built site carries its version, and a script or stylesheet address changes with its file', (t) => {
  const dir = temp(t);
  const output = buildSite(env, path.join(dir, 'site'));
  const version = JSON.parse(fs.readFileSync(path.join(output, 'version.json'), 'utf8')).version;
  assert.match(version, /^[0-9a-f]{12}$/);
  const window = {};
  vm.runInContext(fs.readFileSync(path.join(output, 'assets/js/config.js'), 'utf8'), vm.createContext({ window }));
  assert.equal(window.APP_CONFIG.VERSION, version, 'a page knows the version it was built as');

  const print = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex').slice(0, 12);
  for (const page of ['admin.html', 'index.html', 'viewer.html']) {
    const html = fs.readFileSync(path.join(output, page), 'utf8');
    const local = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="((?:assets|shared)\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(local.length >= 6, page + ' names its files');
    for (const address of local) {
      const [file, stamp] = address.split('?v=');
      assert.equal(stamp, print(file), page + ': ' + file + ' is named with the fingerprint of its content');
    }
    assert.ok(local.some((a) => a.startsWith('assets/js/fresh.js?v=')), page + ' watches for a newer site');
    assert.equal(fs.readFileSync(path.join(root, page), 'utf8').includes('?v='), false, 'the source page is not stamped');
  }

  // The same files give the same version, so a push that changes nothing a visitor loads reloads nobody.
  const again = buildSite(env, path.join(dir, 'again'));
  assert.equal(fs.readFileSync(path.join(again, 'version.json'), 'utf8'), fs.readFileSync(path.join(output, 'version.json'), 'utf8'));
  const moved = buildSite({ API_URL: env.API_URL.replace('test-deployment', 'other-deployment') }, path.join(dir, 'moved'));
  assert.notEqual(JSON.parse(fs.readFileSync(path.join(moved, 'version.json'), 'utf8')).version, version, 'a new backend address is a new version');
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

/** Records every command of a setup run and answers from a table of canned results. */
function fakeSetup(t, answers = {}) {
  const dir = temp(t);
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(home, '.clasprc.json'), env.CLASPRC_JSON);
  const calls = [];
  const run = (command, args, options = {}) => {
    const line = [command, ...args].join(' ');
    calls.push({ line, input: options.input, cwd: options.cwd, project: fs.existsSync(path.join(dir, '.clasp.json')) });
    const key = Object.keys(answers).find((part) => line.includes(part));
    return { status: 0, stdout: '', stderr: '', ...(key ? answers[key] : {}) };
  };
  return { calls, dir, lines: () => calls.map((call) => call.line), options: { run, root: dir, home, log: () => {} } };
}

const newId = 'AKfycbTestDeployment_0123456789';

test('Setup: a first run creates the web app and stores its address in GitHub', (t) => {
  const fake = fakeSetup(t, {
    'variable get': { status: 1 },
    ' deploy ': { stdout: 'Deployed ' + newId + ' @1' },
    '--jq .build_type': { status: 1, stderr: 'Not Found' }
  });
  const result = setup(env.APPS_SCRIPT_ID, fake.options);
  assert.equal(result.url, 'https://script.google.com/macros/s/' + newId + '/exec');
  assert.equal(apiUrl({ API_URL: result.url, APPS_SCRIPT_DEPLOYMENT_ID: result.id }), result.url);
  const lines = fake.lines();
  const order = ['bundle-backend.js', 'push --force', ' deploy --description', 'variable set APPS_SCRIPT_ID --body test-script',
    'variable set APPS_SCRIPT_DEPLOYMENT_ID --body ' + newId, 'variable set API_URL --body ' + result.url,
    'secret set CLASPRC_JSON', '-X POST repos/{owner}/{repo}/pages -f build_type=workflow'];
  const positions = order.map((part) => lines.findIndex((line) => line.includes(part)));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.equal(positions.includes(-1), false, lines.join('\n'));
  assert.equal(fake.calls.find((call) => call.line.includes('push --force')).project, true);
  assert.equal(fs.existsSync(path.join(fake.dir, '.clasp.json')), false);
});

test('Setup: the credential reaches GitHub through standard input only', (t) => {
  const fake = fakeSetup(t, { ' deploy ': { stdout: 'Deployed ' + newId + ' @1' }, 'variable get': { status: 1 } });
  setup(env.APPS_SCRIPT_ID, fake.options);
  const secret = fake.calls.find((call) => call.line.includes('secret set'));
  assert.equal(secret.input, env.CLASPRC_JSON);
  assert.equal(fake.lines().some((line) => line.includes('test-only')), false);
  assert.equal(fake.lines().some((line) => line.includes(' login')), false);
});

test('Setup: a stored deployment is updated in place and Pages is left alone', (t) => {
  const fake = fakeSetup(t, { 'variable get': { stdout: 'test-deployment\n' }, '--jq .build_type': { stdout: 'workflow\n' } });
  assert.equal(setup(env.APPS_SCRIPT_ID, fake.options).url, env.API_URL);
  assert.equal(fake.lines().some((line) => line.includes('deploy -i test-deployment')), true);
  assert.equal(fake.lines().some((line) => line.includes('repos/{owner}/{repo}/pages -f')), false);
});

test('Setup: a branch-built Pages site is switched to GitHub Actions', (t) => {
  const fake = fakeSetup(t, { 'variable get': { stdout: 'test-deployment' }, '--jq .build_type': { stdout: 'legacy' } });
  setup(env.APPS_SCRIPT_ID, fake.options);
  assert.equal(fake.lines().some((line) => line.includes('-X PUT repos/{owner}/{repo}/pages -f build_type=workflow')), true);
});

test('Setup: a failed step stops before GitHub is configured', (t) => {
  assert.throws(() => setup('not an id', fakeSetup(t).options), /Script ID/);
  const fake = fakeSetup(t, { 'push --force': { status: 1, stderr: 'User has not enabled the Apps Script API' } });
  assert.throws(() => setup(env.APPS_SCRIPT_ID, fake.options), /Apps Script API/);
  assert.equal(fake.lines().some((line) => line.includes('variable set') || line.includes('secret set')), false);
  assert.equal(fs.existsSync(path.join(fake.dir, '.clasp.json')), false);
  assert.throws(() => deploymentId('Created version 1.'), /deployment ID/);
});

test('Setup: without a Script ID a sheet with a bound script is created once', (t) => {
  const created = JSON.stringify({ scriptId: 'new-script', parentId: 'new-sheet', files: [] });
  const fake = fakeSetup(t, {
    'variable get': { status: 1 },
    ' create ': { stdout: 'Creating script...\n' + created },
    ' deploy ': { stdout: 'Deployed ' + newId + ' @1' }
  });
  const result = setup('', fake.options);
  assert.equal(result.scriptId, 'new-script');
  assert.equal(result.sheetUrl, 'https://docs.google.com/spreadsheets/d/new-sheet/edit');
  const create = fake.calls.find((call) => call.line.includes('create --type sheets --title Forms Registry --json'));
  assert.notEqual(create.cwd, fake.dir);
  assert.equal(fs.existsSync(create.cwd), false);
  const lines = fake.lines();
  assert.equal(lines.indexOf('gh variable set APPS_SCRIPT_ID --body new-script') < lines.findIndex((line) => line.includes('push --force')), true);

  const again = fakeSetup(t, { 'variable get APPS_SCRIPT_ID': { stdout: 'new-script' },
    'variable get APPS_SCRIPT_DEPLOYMENT_ID': { stdout: 'test-deployment' } });
  assert.equal(setup('', again.options).scriptId, 'new-script');
  assert.equal(again.lines().some((line) => line.includes(' create ')), false);
  assert.throws(() => createdProject('User has not enabled the Apps Script API.'), /Script ID/);
});

test('Setup: on a terminal the owner chooses a new sheet or an existing one', (t) => {
  const created = JSON.stringify({ scriptId: 'new-script', parentId: 'new-sheet' });
  const answers = { 'variable get': { status: 1 }, ' create ': { stdout: created }, ' deploy ': { stdout: 'Deployed ' + newId + ' @1' } };
  const scripted = (replies) => { const asked = []; return { asked, ask: (question) => { asked.push(question); return replies.shift(); } }; };
  const created_ = (fake) => fake.lines().some((line) => line.includes(' create '));

  for (const reply of ['', '1']) {
    const fake = fakeSetup(t, answers);
    assert.equal(setup('', { ...fake.options, ask: scripted([reply]).ask }).scriptId, 'new-script');
  }
  const existing = fakeSetup(t, answers);
  assert.equal(setup('', { ...existing.options, ask: scripted(['2', 'my-script']).ask }).scriptId, 'my-script');
  assert.equal(created_(existing), false);

  for (const replies of [['2', ''], ['2', 'not an id'], ['x']]) {
    const fake = fakeSetup(t, answers);
    assert.throws(() => setup('', { ...fake.options, ask: scripted(replies).ask }), /[Nn]othing was created/);
    assert.equal(created_(fake) || fake.lines().some((line) => line.includes('variable set')), false);
  }
  const stored = fakeSetup(t, { 'variable get': { stdout: 'test-deployment' } });
  const silent = scripted([]);
  setup('', { ...stored.options, ask: silent.ask });
  setup('given-script', { ...fakeSetup(t, answers).options, ask: silent.ask });
  assert.deepEqual(silent.asked, []);
});

test('Setup: the workstation and the workflow pin the same clasp version', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  const pins = [...workflow.matchAll(/@google\/clasp@[0-9.]+/g)].map((match) => match[0]);
  assert.equal(pins.length > 0 && pins.every((pin) => pin === CLASP), true);
});

test('Workflow: a push that changes no backend file skips the Apps Script deployment', () => {
  const { backendChanged, touchesBackend } = require('../scripts/backend-changed.js');
  assert.equal(touchesBackend(['README.md', 'docs/operations/DEPLOY.md', 'assets/js/admin.js', 'index.html', 'tests/core.test.js']), false);
  for (const file of ['backend/Views.gs', 'backend/appsscript.json', 'shared/rules.js', 'scripts/bundle-backend.js', '.github/workflows/pages.yml']) {
    assert.equal(touchesBackend(['README.md', file]), true, file);
  }
  assert.equal(touchesBackend(['docs/backend/notes.md', 'scripts/bundle-backend.js.bak']), false, 'only the real paths count');

  const before = 'a'.repeat(40);
  const git = (files) => (cmd, args) => (args[0] === 'diff' ? files.join('\n') + '\n' : '');
  const push = { GITHUB_EVENT_NAME: 'push', BEFORE: before };
  assert.equal(backendChanged(push, git(['README.md', 'docs/operations/DEPLOY.md'])).changed, false);
  assert.equal(backendChanged(push, git(['README.md', 'backend/Auth.gs'])).changed, true);
  // Whenever the push cannot be compared, the backend is deployed.
  assert.equal(backendChanged({ GITHUB_EVENT_NAME: 'workflow_dispatch', BEFORE: before }, git(['README.md'])).changed, true);
  assert.equal(backendChanged({ GITHUB_EVENT_NAME: 'push', BEFORE: '0'.repeat(40) }, git(['README.md'])).changed, true, 'a first push');
  assert.equal(backendChanged({ GITHUB_EVENT_NAME: 'push', BEFORE: '' }, git(['README.md'])).changed, true);
  assert.equal(backendChanged(push, () => { throw new Error('unknown revision'); }).changed, true, 'a rewritten branch');

  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /needs\.test\.outputs\.backend == 'true'/, 'the backend job follows the answer');
  assert.match(workflow, /needs\.apps-script\.result == 'skipped'/, 'the site is published when the backend job is skipped');
  assert.match(workflow, /GITHUB_STEP_SUMMARY/, 'the deployed version is written to the run summary');
});
