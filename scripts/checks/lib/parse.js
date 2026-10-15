/** Turns a source file into a syntax tree with its comments. */
const acorn = require('acorn');

const OPTIONS = {
  ecmaVersion: 'latest',
  sourceType: 'script',
  locations: true,
  allowHashBang: true,
  allowReturnOutsideFunction: true
};

/**
 * Parses JavaScript as a classic script, which is what every file here is.
 *
 * @param {string} source The text of the file.
 * @return {{ast: !Object, comments: !Array<!Object>}} The tree, and every
 *     comment with its position.
 */
function parse(source) {
  const comments = [];
  const ast = acorn.parse(source, { ...OPTIONS, onComment: comments });
  return { ast, comments };
}

module.exports = { parse };
