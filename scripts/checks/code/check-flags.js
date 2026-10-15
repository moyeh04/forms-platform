/**
 * Checks that yes/no values stay booleans in code. The sheet stores them as
 * the strings '1' and '0', so reading and writing them belongs to
 * `Cell.readFlag` and `Cell.writeFlag` in `backend/platform/sheets/cell.js`,
 * the one file `flags.exclude` lets through. Anywhere else, a field compared
 * with '1' or '0', or a choice that writes '1' or '0', is refused.
 */
const walk = require('acorn-walk');
const { select, read } = require('../lib/files.js');
const { parse } = require('../lib/parse.js');

const FLAGS = ['1', '0'];
const EQUALITY = ['===', '!==', '==', '!='];

/**
 * Says whether a node is a string flag literal.
 *
 * @param {!Object} node Any node.
 * @return {boolean} True for '1' or '0'.
 */
function isFlag(node) {
  return node.type === 'Literal' && FLAGS.includes(node.value);
}

/**
 * Says whether a node reads a stored field: `row.done` or `String(row.done)`.
 *
 * @param {!Object} node Any node.
 * @return {boolean} True when it reads a member, raw or as a string.
 */
function readsField(node) {
  if (node.type === 'MemberExpression') return true;
  return (
    node.type === 'CallExpression' &&
    node.callee.name === 'String' &&
    node.arguments[0]?.type === 'MemberExpression'
  );
}

/**
 * Says what is wrong with one expression, if it handles a flag string.
 *
 * @param {!Object} node An expression.
 * @return {string} The problem, or an empty string.
 */
function flagProblem(node) {
  if (node.type === 'BinaryExpression' && EQUALITY.includes(node.operator)) {
    const pairs = [
      [node.left, node.right],
      [node.right, node.left]
    ];
    if (pairs.some(([a, b]) => isFlag(a) && readsField(b))) {
      return 'a field compared with a flag string';
    }
  }
  if (node.type === 'ConditionalExpression') {
    const sides = [node.consequent, node.alternate];
    const strings = sides.every((side) => typeof side.value === 'string');
    if (strings && sides.some(isFlag)) return 'a flag string written';
  }
  return '';
}

/**
 * Checks the flag handling of one file.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @return {!Array<!Object>} One finding for each flag string.
 */
function checkSource(file, source) {
  const out = [];
  walk.full(parse(source).ast, (node) => {
    const problem = flagProblem(node);
    if (!problem) return;
    out.push({
      file,
      line: node.loc.start.line,
      rule: 'flags',
      message: `${problem}; use Cell.readFlag or Cell.writeFlag`
    });
  });
  return out;
}

/**
 * Checks the flag handling of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each flag string.
 */
function check(root, files, config) {
  return select(files, config.flags).flatMap((file) =>
    checkSource(file, read(root, file))
  );
}

module.exports = { check, checkSource };
