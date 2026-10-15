const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../../domain/rules/index.js');

test('Small teams: warnings start from the biggest size and are off', () => {
  const six = { rules: { teamSize: { min: 1, max: 6 } } };
  assert.deepEqual(R.sizeAlerts(six), {
    critical: { on: false, below: 3 },
    warning: { on: false, below: 5 }
  });
  assert.deepEqual(
    R.sizeAlerts({ rules: { teamSize: { min: 1, max: 4 } } }).warning,
    { on: false, below: 3 }
  );
  assert.deepEqual(R.sizeAlertLevels(R.sizeAlerts(six)), [], 'no level is on');
  const saved = {
    rules: {
      teamSize: { min: 1, max: 4 },
      sizeAlerts: {
        critical: { on: true, below: '2' },
        warning: { on: true, below: 9 }
      }
    }
  };
  assert.deepEqual(
    R.sizeAlerts(saved),
    { critical: { on: true, below: 2 }, warning: { on: true, below: 4 } },
    'a number over the biggest team is brought down to it'
  );
});

test('Small teams: the stronger level wins; wrong numbers are named', () => {
  const form = (sizeAlerts) => ({
    rules: { teamSize: { min: 1, max: 6 }, sizeAlerts }
  });
  const both = R.sizeAlerts(
    form({ critical: { on: true, below: 3 }, warning: { on: true, below: 5 } })
  );
  assert.deepEqual(R.sizeAlertLevels(both), [
    { level: 'critical', below: 3 },
    { level: 'warning', below: 5 }
  ]);
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((n) => R.sizeAlertOf(both, n)),
    ['critical', 'critical', 'warning', 'warning', '', '']
  );
  const one = R.sizeAlerts(form({ warning: { on: true, below: 4 } }));
  assert.deepEqual(
    [2, 3, 4].map((n) => R.sizeAlertOf(one, n)),
    ['warning', 'warning', '']
  );
  assert.equal(
    R.sizeAlertsProblem(
      form({
        critical: { on: true, below: 3 },
        warning: { on: true, below: 5 }
      })
    ),
    null
  );
  assert.deepEqual(
    R.sizeAlertsProblem(
      form({
        critical: { on: true, below: 4 },
        warning: { on: true, below: 4 }
      })
    ),
    { level: 'warning', error: 'order', min: 2, max: 6 }
  );
  assert.deepEqual(
    R.sizeAlertsProblem(form({ critical: { on: true, below: 1 } })),
    { level: 'critical', error: 'range', min: 2, max: 6 }
  );
  assert.equal(
    R.sizeAlertsProblem(form({ warning: { on: true, below: 7 } })).error,
    'range'
  );
  assert.equal(
    R.sizeAlertsProblem(form({ warning: { on: true, below: '' } })).error,
    'range'
  );
  assert.equal(
    R.sizeAlertsProblem(
      form({
        critical: { on: false, below: 99 },
        warning: { on: true, below: 2 }
      })
    ),
    null,
    'a level that is off is not checked'
  );
});

test('Small teams: the levels are critical then warning', () => {
  assert.deepEqual(R.sizeAlertLevelIds(), ['critical', 'warning']);
  R.sizeAlertLevelIds().pop();
  assert.equal(R.sizeAlertLevelIds().length, 2, 'each call gives a copy');
});

test('Small teams: a level asks for 2 up to the biggest team size', () => {
  const sized = (max) => ({ rules: { teamSize: { min: 1, max } } });
  assert.deepEqual(R.sizeAlertBounds(sized(6)), { min: 2, max: 6 });
  assert.deepEqual(
    R.sizeAlertBounds(sized(1)),
    { min: 2, max: 2 },
    'a form of single students still has a number to pick'
  );
});
