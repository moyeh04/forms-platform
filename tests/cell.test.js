const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('./harness/appsscript-mock.js');

test('Cell: a flag reads yes, no, or the default of its column', () => {
  const w = createWorld();
  const read = (cell, whenAbsent) => w.call('Cell.readFlag', cell, whenAbsent);
  assert.deepEqual(
    ['1', 1, '0', 0].map((cell) => read(cell, true)),
    [true, true, false, false]
  );
  for (const cell of ['', undefined, 'TRUE', 'yes']) {
    assert.equal(read(cell, true), true, `${cell} with default yes`);
    assert.equal(read(cell, false), false, `${cell} with default no`);
  }
});

test('Cell: a flag writes 1 for yes and the column’s own cell for no', () => {
  const w = createWorld();
  const write = (value, falseCell) =>
    w.call('Cell.writeFlag', value, falseCell);
  assert.deepEqual(
    [write(true, '0'), write(false, '0'), write(true, ''), write(false, '')],
    ['1', '0', '1', '']
  );
});
