const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSource
} = require('../../../../scripts/checks/code/check-numbers.js');

const ALLOWED = [0, 1, 2, 10, 24, 60];
const problems = (source) =>
  checkSource('a.js', source, ALLOWED).map((f) => `${f.line} ${f.message}`);

test('Number check: a number named by a constant passes', () => {
  const source = `
const WAIT_MS = 5000;
var LIMIT_ = -30;
const LIMITS = { rows: 500, cols: [3, 4], deep: { cells: 9 } };
App.TIMEOUT = 300;
const style = { WIDTH: 140 };
let i = 0;
const back = -1;
// biome-ignore lint/style/noMagicNumbers: the RFC fixes this length
const size = 16;
`;
  assert.deepEqual(problems(source), []);
});

test('Number check: an unnamed initial value is found', () => {
  const source = `
let wait = 5000;
const box = { width: 300, inner: { gap: -8 } };
function retry(times = 3) {}
`;
  assert.deepEqual(problems(source), [
    '2 5000 has no name; give it a CONSTANT_CASE constant',
    '3 300 has no name; give it a CONSTANT_CASE constant',
    '3 8 has no name; give it a CONSTANT_CASE constant',
    '4 3 has no name; give it a CONSTANT_CASE constant'
  ]);
});

test('Number check: numbers Biome already covers are left to it', () => {
  const source = `
foo(300);
const total = price * 7;
const list = [5, 6];
`;
  assert.deepEqual(problems(source), []);
});
