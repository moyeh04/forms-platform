const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSource
} = require('../../../../scripts/checks/code/check-comments.js');

const problems = (file, source) =>
  checkSource(file, source).map((f) => `${f.line} ${f.message}`);

const WORKFLOW = [
  '# Tests every push.',
  'name: Test',
  'on: push',
  'jobs:',
  '  # Runs the tests.',
  '  test:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - run: npm test',
  '  deploy:',
  '    needs: test',
  ''
].join('\n');

test('Comment check: a hook and a workflow with their comments pass', () => {
  assert.deepEqual(
    problems('.githooks/pre-commit', '#!/bin/sh\n# Runs the checks.\nnpm t\n'),
    []
  );
  assert.deepEqual(problems('scripts/dev/a.sh', '# Sets git up.\ngit\n'), []);
  const commented = WORKFLOW.replace(
    '  deploy:',
    '  # Deploys what passed.\n  deploy:'
  );
  assert.deepEqual(problems('.github/workflows/ci.yml', commented), []);
});

test('Comment check: a missing header and an uncommented job are found', () => {
  assert.deepEqual(problems('.githooks/pre-push', '#!/bin/sh\nnpm t\n'), [
    '2 no comment saying what the script does and when it runs'
  ]);
  assert.deepEqual(problems('scripts/dev/a.sh', 'git config\n'), [
    '1 no comment saying what the script does and when it runs'
  ]);
  assert.deepEqual(
    problems('.github/workflows/ci.yml', WORKFLOW.replace(/^# .*\n/, '')),
    [
      '1 no comment saying what the workflow runs and when',
      '9 job deploy has no comment saying why it runs'
    ]
  );
});
