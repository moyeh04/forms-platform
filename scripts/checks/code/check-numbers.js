/**
 * Checks the numbers Biome's noMagicNumbers lets through. Biome skips a number
 * that initialises a variable, a property or a default parameter, so
 * `let wait = 5000` passes it. Here such a number passes only when it is
 * named in CONSTANT_CASE: by its variable, by its property, or by a constant
 * object or array it sits in. The numbers Biome allows (0, 1, 2, 10, 24, 60
 * and their negatives) are allowed here too.
 */
const walk = require('acorn-walk');
const { select, read } = require('../lib/files.js');
const { parse } = require('../lib/parse.js');

const CONSTANT = /^[A-Z][A-Z0-9_]*$/;
const IGNORE = 'biome-ignore lint/style/noMagicNumbers';
const CONTAINERS = ['ObjectExpression', 'ArrayExpression', 'Property'];

/**
 * Gives the name a node declares or assigns to, when it has one.
 *
 * @param {!Object} node A declarator, a property or an assignment.
 * @return {string} The name, or an empty string.
 */
function nameOf(node) {
  const target = node.id || node.key || node.left;
  if (!target) return '';
  if (target.type === 'MemberExpression') return target.property.name || '';
  return target.name || String(target.value || '');
}

/**
 * Says whether a number in an initialiser is named by a constant: the
 * nearest variable, property or assignment that holds it is in CONSTANT_CASE.
 *
 * @param {!Array<!Object>} holders The nodes from the number's place up to
 *     the statement, nearest first.
 * @return {boolean} True when a constant names it.
 */
function named(holders) {
  for (const node of holders) {
    if (CONSTANT.test(nameOf(node))) return true;
    if (!CONTAINERS.includes(node.type)) return false;
  }
  return false;
}

/**
 * Finds the node that holds a number as its initial value, skipping a sign.
 *
 * @param {!Array<!Object>} ancestors The nodes from the root down to the
 *     number.
 * @return {!Array<!Object>} The holder and the nodes above it, nearest
 *     first; empty when the number is not an initial value.
 */
function holdersOf(ancestors) {
  const up = ancestors.slice(0, -1).reverse();
  let value = ancestors[ancestors.length - 1];
  while (up[0]?.type === 'UnaryExpression') value = up.shift();
  const holder = up[0] || {};
  const holds =
    holder.init === value ||
    (holder.type === 'Property' && holder.value === value) ||
    (holder.type === 'AssignmentPattern' && holder.right === value);
  return holds ? up : [];
}

/**
 * Lists the lines whose next line Biome is told to leave alone.
 *
 * @param {!Array<!Object>} comments Every comment of the file.
 * @return {!Set<number>} The lines that follow an ignore comment.
 */
function ignoredLines(comments) {
  return new Set(
    comments
      .filter((comment) => comment.value.includes(IGNORE))
      .map((comment) => comment.loc.end.line + 1)
  );
}

/**
 * Checks the numbers of one file.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @param {!Array<number>} allowed Numbers that need no name.
 * @return {!Array<!Object>} One finding for each unnamed number.
 */
function checkSource(file, source, allowed) {
  const { ast, comments } = parse(source);
  const ignored = ignoredLines(comments);
  const out = [];
  walk.fullAncestor(ast, (node, _state, ancestors) => {
    if (typeof node.value !== 'number' || node.type !== 'Literal') return;
    if (allowed.includes(node.value)) return;
    const holders = holdersOf(ancestors);
    const line = node.loc.start.line;
    if (!holders.length || named(holders) || ignored.has(line)) return;
    out.push({
      file,
      line,
      rule: 'numbers',
      message: `${node.raw} has no name; give it a CONSTANT_CASE constant`
    });
  });
  return out;
}

/**
 * Checks the numbers of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each unnamed number.
 */
function check(root, files, config) {
  return select(files, config.numbers).flatMap((file) =>
    checkSource(file, read(root, file), config.numbers.allowed)
  );
}

module.exports = { check, checkSource };
