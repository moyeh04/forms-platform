const test = require('node:test');
const assert = require('node:assert/strict');
const exceptions = require('../../../../scripts/checks/lib/exceptions.js');

const at = (file, rule, line = 1) => ({ file, line, rule, message: 'x' });

test('Exceptions: cover a path and rule, need a reason, fail unused', () => {
  const entries = [
    {
      path: 'index.html',
      rule: 'structure/root',
      reason: 'the pages are served from the site root'
    },
    { path: 'old.js', rule: 'structure/root', reason: 'legacy' }
  ];
  const { kept, unused } = exceptions.apply(
    [at('index.html', 'structure/root'), at('index.html', 'lines')],
    entries
  );
  assert.deepEqual(
    kept.map((f) => f.rule),
    ['lines']
  );
  assert.deepEqual(unused, [
    'old.js: the structure/root exception matches nothing'
  ]);
  assert.deepEqual(exceptions.weakReasons(entries), [
    'old.js: the structure/root exception needs a reason'
  ]);
});
