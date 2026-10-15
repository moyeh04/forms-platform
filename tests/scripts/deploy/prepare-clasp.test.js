const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  deploymentConfig,
  prepareClasp
} = require('../../../scripts/deploy/prepare-clasp.js');
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

test(
  'Deployment: absent IDs or credentials are explicit failures without ' +
    'exposing tokens',
  () => {
    for (const key of [
      'APPS_SCRIPT_ID',
      'APPS_SCRIPT_DEPLOYMENT_ID',
      'CLASPRC_JSON'
    ]) {
      assert.throws(
        () => deploymentConfig({ ...env, [key]: '' }),
        new RegExp(key)
      );
    }
    for (const credentials of ['bad-secret-test-only', 'null', '[]', '{}']) {
      assert.throws(
        () => deploymentConfig({ ...env, CLASPRC_JSON: credentials }),
        (error) =>
          error.message.includes('CLASPRC_JSON') &&
          !error.message.includes('test-only')
      );
    }
  }
);

test(
  'Deployment: clasp targets dist and writes private credentials ' +
    'separately',
  (t) => {
    const dir = temp(t);
    const home = path.join(dir, 'home');
    fs.mkdirSync(home);
    prepareClasp(env, dir, home);
    const project = JSON.parse(
      fs.readFileSync(path.join(dir, '.clasp.json'), 'utf8')
    );
    assert.deepEqual(project, {
      scriptId: env.APPS_SCRIPT_ID,
      rootDir: './dist'
    });
    const auth = path.join(home, '.clasprc.json');
    assert.deepEqual(
      JSON.parse(fs.readFileSync(auth, 'utf8')),
      JSON.parse(env.CLASPRC_JSON)
    );
    assert.equal(fs.statSync(auth).mode & 0o777, 0o600);
  }
);
