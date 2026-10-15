const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { apiUrl } = require('../../../scripts/build/build-site.js');
const {
  CLASP,
  createdProject,
  deploymentId,
  setup
} = require('../../../scripts/deploy/setup-deployment.js');

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

/** Records every command of a setup run and answers from a table of canned results. */
function fakeSetup(t, answers = {}) {
  const dir = temp(t);
  const home = path.join(dir, 'home');
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(home, '.clasprc.json'), env.CLASPRC_JSON);
  const calls = [];
  const run = (command, args, options = {}) => {
    const line = [command, ...args].join(' ');
    calls.push({
      line,
      input: options.input,
      cwd: options.cwd,
      project: fs.existsSync(path.join(dir, '.clasp.json'))
    });
    const key = Object.keys(answers).find((part) => line.includes(part));
    return { status: 0, stdout: '', stderr: '', ...(key ? answers[key] : {}) };
  };
  return {
    calls,
    dir,
    lines: () => calls.map((call) => call.line),
    options: { run, root: dir, home, log: () => {} }
  };
}

const newId = 'AKfycbTestDeployment_0123456789';

test(
  'Setup: a first run creates the web app and stores its address in ' +
    'GitHub',
  (t) => {
    const fake = fakeSetup(t, {
      'variable get': { status: 1 },
      ' deploy ': { stdout: 'Deployed ' + newId + ' @1' },
      '--jq .build_type': { status: 1, stderr: 'Not Found' }
    });
    const result = setup(env.APPS_SCRIPT_ID, fake.options);
    assert.equal(
      result.url,
      'https://script.google.com/macros/s/' + newId + '/exec'
    );
    assert.equal(
      apiUrl({ API_URL: result.url, APPS_SCRIPT_DEPLOYMENT_ID: result.id }),
      result.url
    );
    const lines = fake.lines();
    const order = [
      'bundle-backend.js',
      'push --force',
      ' deploy --description',
      'variable set APPS_SCRIPT_ID --body test-script',
      'variable set APPS_SCRIPT_DEPLOYMENT_ID --body ' + newId,
      'variable set API_URL --body ' + result.url,
      'secret set CLASPRC_JSON',
      '-X POST repos/{owner}/{repo}/pages -f build_type=workflow'
    ];
    const positions = order.map((part) =>
      lines.findIndex((line) => line.includes(part))
    );
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b)
    );
    assert.equal(positions.includes(-1), false, lines.join('\n'));
    assert.equal(
      fake.calls.find((call) => call.line.includes('push --force')).project,
      true
    );
    assert.equal(fs.existsSync(path.join(fake.dir, '.clasp.json')), false);
  }
);

test(
  'Setup: the credential reaches ' + 'GitHub through standard input only',
  (t) => {
    const fake = fakeSetup(t, {
      ' deploy ': { stdout: 'Deployed ' + newId + ' @1' },
      'variable get': { status: 1 }
    });
    setup(env.APPS_SCRIPT_ID, fake.options);
    const secret = fake.calls.find((call) => call.line.includes('secret set'));
    assert.equal(secret.input, env.CLASPRC_JSON);
    assert.equal(
      fake.lines().some((line) => line.includes('test-only')),
      false
    );
    assert.equal(
      fake.lines().some((line) => line.includes(' login')),
      false
    );
  }
);

test(
  'Setup: a stored deployment is updated in place and Pages is left ' + 'alone',
  (t) => {
    const fake = fakeSetup(t, {
      'variable get': { stdout: 'test-deployment\n' },
      '--jq .build_type': { stdout: 'workflow\n' }
    });
    assert.equal(setup(env.APPS_SCRIPT_ID, fake.options).url, env.API_URL);
    assert.equal(
      fake.lines().some((line) => line.includes('deploy -i test-deployment')),
      true
    );
    assert.equal(
      fake
        .lines()
        .some((line) => line.includes('repos/{owner}/{repo}/pages -f')),
      false
    );
  }
);

test('Setup: a branch-built Pages site is switched to GitHub Actions', (t) => {
  const fake = fakeSetup(t, {
    'variable get': { stdout: 'test-deployment' },
    '--jq .build_type': { stdout: 'legacy' }
  });
  setup(env.APPS_SCRIPT_ID, fake.options);
  assert.equal(
    fake
      .lines()
      .some((line) =>
        line.includes(
          '-X PUT repos/{owner}/{repo}/pages -f build_type=workflow'
        )
      ),
    true
  );
});

test('Setup: a failed step stops before GitHub is configured', (t) => {
  assert.throws(() => setup('not an id', fakeSetup(t).options), /Script ID/);
  const fake = fakeSetup(t, {
    'push --force': {
      status: 1,
      stderr: 'User has not enabled the Apps Script API'
    }
  });
  assert.throws(
    () => setup(env.APPS_SCRIPT_ID, fake.options),
    /Apps Script API/
  );
  assert.equal(
    fake
      .lines()
      .some(
        (line) => line.includes('variable set') || line.includes('secret set')
      ),
    false
  );
  assert.equal(fs.existsSync(path.join(fake.dir, '.clasp.json')), false);
  assert.throws(() => deploymentId('Created version 1.'), /deployment ID/);
});

test(
  'Setup: without a Script ID a sheet with a bound script is created ' + 'once',
  (t) => {
    const created = JSON.stringify({
      scriptId: 'new-script',
      parentId: 'new-sheet',
      files: []
    });
    const fake = fakeSetup(t, {
      'variable get': { status: 1 },
      ' create ': { stdout: 'Creating script...\n' + created },
      ' deploy ': { stdout: 'Deployed ' + newId + ' @1' }
    });
    const result = setup('', fake.options);
    assert.equal(result.scriptId, 'new-script');
    assert.equal(
      result.sheetUrl,
      'https://docs.google.com/spreadsheets/d/new-sheet/edit'
    );
    const create = fake.calls.find((call) =>
      call.line.includes('create --type sheets --title Forms Registry --json')
    );
    assert.notEqual(create.cwd, fake.dir);
    assert.equal(fs.existsSync(create.cwd), false);
    const lines = fake.lines();
    assert.equal(
      lines.indexOf('gh variable set APPS_SCRIPT_ID --body new-script') <
        lines.findIndex((line) => line.includes('push --force')),
      true
    );

    const again = fakeSetup(t, {
      'variable get APPS_SCRIPT_ID': { stdout: 'new-script' },
      'variable get APPS_SCRIPT_DEPLOYMENT_ID': { stdout: 'test-deployment' }
    });
    assert.equal(setup('', again.options).scriptId, 'new-script');
    assert.equal(
      again.lines().some((line) => line.includes(' create ')),
      false
    );
    assert.throws(
      () => createdProject('User has not enabled the Apps Script API.'),
      /Script ID/
    );
  }
);

test(
  'Setup: on a terminal the owner chooses a new sheet or an existing ' + 'one',
  (t) => {
    const created = JSON.stringify({
      scriptId: 'new-script',
      parentId: 'new-sheet'
    });
    const answers = {
      'variable get': { status: 1 },
      ' create ': { stdout: created },
      ' deploy ': { stdout: 'Deployed ' + newId + ' @1' }
    };
    const scripted = (replies) => {
      const asked = [];
      return {
        asked,
        ask: (question) => {
          asked.push(question);
          return replies.shift();
        }
      };
    };
    const created_ = (fake) =>
      fake.lines().some((line) => line.includes(' create '));

    for (const reply of ['', '1']) {
      const fake = fakeSetup(t, answers);
      assert.equal(
        setup('', { ...fake.options, ask: scripted([reply]).ask }).scriptId,
        'new-script'
      );
    }
    const existing = fakeSetup(t, answers);
    assert.equal(
      setup('', { ...existing.options, ask: scripted(['2', 'my-script']).ask })
        .scriptId,
      'my-script'
    );
    assert.equal(created_(existing), false);

    for (const replies of [['2', ''], ['2', 'not an id'], ['x']]) {
      const fake = fakeSetup(t, answers);
      assert.throws(
        () => setup('', { ...fake.options, ask: scripted(replies).ask }),
        /[Nn]othing was created/
      );
      assert.equal(
        created_(fake) ||
          fake.lines().some((line) => line.includes('variable set')),
        false
      );
    }
    const stored = fakeSetup(t, {
      'variable get': { stdout: 'test-deployment' }
    });
    const silent = scripted([]);
    setup('', { ...stored.options, ask: silent.ask });
    setup('given-script', {
      ...fakeSetup(t, answers).options,
      ask: silent.ask
    });
    assert.deepEqual(silent.asked, []);
  }
);

test(
  'Setup: the workstation and the ' + 'workflow pin the same clasp version',
  () => {
    const workflow = fs.readFileSync(
      path.join(root, '.github/workflows/pages.yml'),
      'utf8'
    );
    const pins = [...workflow.matchAll(/@google\/clasp@[0-9.]+/g)].map(
      (match) => match[0]
    );
    assert.equal(pins.length > 0 && pins.every((pin) => pin === CLASP), true);
  }
);
