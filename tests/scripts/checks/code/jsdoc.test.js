const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checkSource
} = require('../../../../scripts/checks/code/check-jsdoc.js');

const FORBIDDEN = ['author', 'date', 'version'];
const problems = (source) =>
  checkSource('a.js', source, FORBIDDEN).map((f) => `${f.line} ${f.message}`);

test('JSDoc check: a full Google-style doc passes in each place', () => {
  const source = `
/**
 * Adds two numbers.
 *
 * @param {number} a The first.
 * @param {number=} b The second, if any.
 * @return {number} The sum.
 */
function add(a, b = 0) {
  return a + b;
}

/**
 * Logs a line.
 *
 * @param {string} text What to log.
 */
const log = (text) => {
  console.log(text);
};

const Api = {
  /**
   * Reads a {{nested: string}} value.
   *
   * @param {{nested: string}} options What to read.
   * @return {string} The value.
   */
  read: function (options) {
    return [1].map((x) => x + options.nested)[0];
  }
};
`;
  assert.deepEqual(problems(source), []);
});

test('JSDoc check: a missing doc, wrong params and a return are found', () => {
  const source = `
function bare() {}

/**
 * Says hello.
 *
 * @param {string} nme Misspelled.
 * @param age No type.
 */
function hello(name) {
  return 'hi ' + name;
}

/**
 * Does nothing.
 *
 * @returns {number} Nothing.
 * @author Someone
 */
App.idle = function () {};
`;
  assert.deepEqual(problems(source), [
    '2 no JSDoc comment',
    '10 2 @param for 1 parameters',
    '10 @param nme for name',
    '10 no {type} on @param age',
    '10 no @return',
    '20 no @author: git keeps that',
    '20 write @return',
    '20 @return on a function that returns nothing'
  ]);
});

test('JSDoc check: a header comment above a blank line is not a doc', () => {
  const source = `/** What the file is for. */

function bare() {}
`;
  assert.deepEqual(problems(source), ['3 no JSDoc comment']);
});

test('JSDoc check: callbacks and wrappers passed to a call need no doc', () => {
  const source = `
(function (App) {
  [1, 2].forEach(function (n) { return n; });
  setTimeout(() => {}, 0);
  new Proxy(App, { get: () => null });
})(window.App);
`;
  assert.deepEqual(problems(source), []);
});
