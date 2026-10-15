const test = require('node:test');
const assert = require('node:assert/strict');
const { checkSource } = require('../../../scripts/checks/check-flags.js');

const problems = (source) =>
  checkSource('a.js', source).map((f) => `${f.line} ${f.message}`);

test('Flag check: a field compared with or written as a flag is found', () => {
  const source = `
const a = String(row.done) === '1';
const b = '0' !== row.active;
const c = { done: item.done ? '1' : '0', gone: item.gone ? '1' : '' };
`;
  const rest = '; use Cell.readFlag or Cell.writeFlag';
  assert.deepEqual(problems(source), [
    `2 a field compared with a flag string${rest}`,
    `3 a field compared with a flag string${rest}`,
    `4 a flag string written${rest}`,
    `4 a flag string written${rest}`
  ]);
});

test('Flag check: other strings, digits and plain variables pass', () => {
  const source = `
if (choice === '1') start();
if (code.charAt(0) === '1') fix();
const pad = n < 10 ? '0' + n : String(n);
const label = done ? 'Yes' : 'No';
const flag = row.done === true;
`;
  assert.deepEqual(problems(source), []);
});
