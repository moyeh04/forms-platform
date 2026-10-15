const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');

test('Workflow: a push that changes no backend file skips the Apps Script deployment', () => {
  const {
    backendChanged,
    touchesBackend
  } = require('../../../scripts/deploy/backend-changed.js');
  assert.equal(
    touchesBackend([
      'README.md',
      'docs/operations/DEPLOY.md',
      'web/js/admin.js',
      'web/index.html',
      'tests/core.test.js'
    ]),
    false
  );
  for (const file of [
    'backend/main.js',
    'backend/appsscript.json',
    'domain/rules/index.js',
    'scripts/build/bundle-backend.js',
    '.github/workflows/pages.yml'
  ]) {
    assert.equal(touchesBackend(['README.md', file]), true, file);
  }
  assert.equal(
    touchesBackend([
      'docs/backend/notes.md',
      'scripts/build/bundle-backend.js.bak'
    ]),
    false,
    'only the real paths count'
  );

  const before = 'a'.repeat(40);
  const git = (files) => (cmd, args) =>
    args[0] === 'diff' ? files.join('\n') + '\n' : '';
  const push = { GITHUB_EVENT_NAME: 'push', BEFORE: before };
  assert.equal(
    backendChanged(push, git(['README.md', 'docs/operations/DEPLOY.md']))
      .changed,
    false
  );
  assert.equal(
    backendChanged(
      push,
      git(['README.md', 'backend/features/access/auth/auth.service.js'])
    ).changed,
    true
  );
  // Whenever the push cannot be compared, the backend is deployed.
  assert.equal(
    backendChanged(
      { GITHUB_EVENT_NAME: 'workflow_dispatch', BEFORE: before },
      git(['README.md'])
    ).changed,
    true
  );
  assert.equal(
    backendChanged(
      { GITHUB_EVENT_NAME: 'push', BEFORE: '0'.repeat(40) },
      git(['README.md'])
    ).changed,
    true,
    'a first push'
  );
  assert.equal(
    backendChanged(
      { GITHUB_EVENT_NAME: 'push', BEFORE: '' },
      git(['README.md'])
    ).changed,
    true
  );
  assert.equal(
    backendChanged(push, () => {
      throw new Error('unknown revision');
    }).changed,
    true,
    'a rewritten branch'
  );

  const workflow = fs.readFileSync(
    path.join(root, '.github/workflows/pages.yml'),
    'utf8'
  );
  assert.match(
    workflow,
    /needs\.test\.outputs\.backend == 'true'/,
    'the backend job follows the answer'
  );
  assert.match(
    workflow,
    /needs\.apps-script\.result == 'skipped'/,
    'the site is published when the backend job is skipped'
  );
  assert.match(
    workflow,
    /GITHUB_STEP_SUMMARY/,
    'the deployed version is written to the run summary'
  );
});
