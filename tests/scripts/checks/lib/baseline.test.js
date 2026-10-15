const test = require('node:test');
const assert = require('node:assert/strict');
const baselines = require('../../../../scripts/checks/lib/baseline.js');

const at = (file, rule, line = 1) => ({ file, line, rule, message: 'x' });

test('Baseline: a legacy file may keep its count, never go over it', () => {
  const baseline = { 'a.js': { lines: 2 } };
  const same = baselines.judge(
    [at('a.js', 'lines'), at('a.js', 'lines')],
    baseline,
    ['a.js']
  );
  assert.deepEqual(same, { failures: [], stale: [] });
  const more = [at('a.js', 'lines'), at('a.js', 'lines'), at('a.js', 'lines')];
  assert.equal(baselines.judge(more, baseline, ['a.js']).failures.length, 3);
  assert.equal(
    baselines.judge([at('b.js', 'lines')], baseline, ['b.js']).failures.length,
    1,
    'a new file has no allowance'
  );
});

test('Baseline: a lower count is written down, never raised', () => {
  const baseline = { 'a.js': { lines: 2, jsdoc: 1 }, 'b.js': { lines: 1 } };
  const findings = [
    at('a.js', 'lines'),
    at('a.js', 'jsdoc'),
    at('a.js', 'jsdoc')
  ];
  assert.deepEqual(baselines.judge(findings, baseline, ['a.js']).stale, [
    'a.js: lines is down to 1 from 2'
  ]);
  assert.deepEqual(
    baselines.lower(baseline, findings, ['a.js']),
    { 'a.js': { lines: 1, jsdoc: 1 }, 'b.js': { lines: 1 } },
    'only the files of the run are lowered, and jsdoc stays at 1'
  );
  assert.deepEqual(
    baselines.lower(baseline, [], ['a.js', 'b.js']),
    {},
    'a file with nothing left leaves the baseline'
  );
  assert.deepEqual(baselines.goneFiles(baseline, ['a.js']), [
    'b.js: in the baseline but no longer tracked'
  ]);
});
