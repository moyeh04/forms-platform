/**
 * Checks that every named function has a JSDoc comment as Google writes it:
 * a summary, one `@param {Type} name` per parameter in order, `@return
 * {Type}` when it returns a value, and no metadata tags such as `@author`.
 * A function passed straight to a call, such as a callback, is exempt, and
 * so is one in an object literal passed straight to a call.
 */
const walk = require('acorn-walk');
const { select, read } = require('./lib/files.js');
const { parse } = require('./lib/parse.js');
const { readDoc } = require('./lib/jsdoc.js');

const FUNCTION = /^(FunctionDeclaration|FunctionExpression|Arrow)/;

/**
 * Finds the statement or property a named function belongs to, which is
 * where its comment sits.
 *
 * @param {!Object} node The function.
 * @param {!Array<!Object>} ancestors The nodes from the root down to it.
 * @return {?Object} The node the comment must precede, or null when the
 *     function has no name of its own.
 */
function anchorOf(node, ancestors) {
  if (node.type === 'FunctionDeclaration') return node;
  const above = ancestors.slice(0, -1);
  const parent = above.pop();
  if (parent.type === 'MethodDefinition') return parent;
  const holds = [parent.init, parent.right, parent.value].includes(node);
  return holds ? holderOf(parent, above) : null;
}

/**
 * Finds where the comment of a function held by a variable, an assignment or
 * an object property sits.
 *
 * @param {!Object} parent The declarator, assignment or property.
 * @param {!Array<!Object>} above The nodes above the parent, root first.
 * @return {?Object} The node the comment must precede, or null when the
 *     function is part of an expression or of an object passed to a call.
 */
function holderOf(parent, above) {
  const grand = above.pop();
  if (parent.type === 'VariableDeclarator') {
    return grand.declarations.length === 1 ? grand : parent;
  }
  if (parent.type === 'AssignmentExpression') {
    return grand.type === 'ExpressionStatement' ? grand : null;
  }
  if (parent.type === 'Property') {
    return /Call|New/.test(above.pop()?.type) ? null : parent;
  }
  return null;
}

/**
 * Finds the JSDoc comment right before a node, with only space between.
 *
 * @param {!Object} anchor The node.
 * @param {!Array<!Object>} comments Every comment of the file.
 * @param {string} source The text of the file.
 * @return {?Object} The comment, or null.
 */
function docBefore(anchor, comments, source) {
  const before = comments.filter((c) => c.end <= anchor.start);
  const last = before[before.length - 1];
  if (last?.type !== 'Block' || !last.value.startsWith('*')) {
    return null;
  }
  return /^\s*$/.test(source.slice(last.end, anchor.start)) ? last : null;
}

/**
 * Lists the names of a function's parameters; a destructured one is null.
 *
 * @param {!Object} node The function.
 * @return {!Array<?string>} The names in order.
 */
function paramNames(node) {
  return node.params.map((param) => {
    if (param.type === 'Identifier') return param.name;
    if (param.type === 'AssignmentPattern') return param.left.name || null;
    if (param.type === 'RestElement') return param.argument.name || null;
    return null;
  });
}

/** Leaves a node unvisited; a nested function's returns are its own. */
function skip() {}

/**
 * Says whether a function returns a value, not counting nested functions.
 *
 * @param {!Object} node The function.
 * @return {boolean} True when some `return` has a value.
 */
function returnsValue(node) {
  if (node.body.type !== 'BlockStatement') return true;
  let found = false;
  walk.recursive(node.body, null, {
    FunctionDeclaration: skip,
    FunctionExpression: skip,
    ArrowFunctionExpression: skip,
    ReturnStatement: (ret) => {
      if (ret.argument) found = true;
    }
  });
  return found;
}

/**
 * Compares the `@param` tags of a doc with the parameters of its function.
 *
 * @param {!Array<!Object>} tags The tags of the doc.
 * @param {!Array<?string>} names The parameter names.
 * @return {!Array<string>} What is wrong.
 */
function paramProblems(tags, names) {
  const params = tags.filter((t) => t.tag === 'param' && !t.name.includes('.'));
  const out = [];
  if (params.length !== names.length) {
    out.push(`${params.length} @param for ${names.length} parameters`);
  }
  names.forEach((name, i) => {
    const said = params[i]?.name;
    if (name && said && said !== name) out.push(`@param ${said} for ${name}`);
  });
  for (const tag of params) {
    if (!tag.type) out.push(`no {type} on @param ${tag.name}`);
  }
  return out;
}

/**
 * Compares the return tags of a doc with what its function returns.
 *
 * @param {!Array<!Object>} tags The tags of the doc.
 * @param {!Object} node The function.
 * @return {!Array<string>} What is wrong.
 */
function returnProblems(tags, node) {
  const returns = tags.filter((t) => t.tag === 'return' || t.tag === 'returns');
  const out = [];
  if (tags.some((t) => t.tag === 'returns')) out.push('write @return');
  if (returnsValue(node) && !returns.length) out.push('no @return');
  if (!returnsValue(node) && returns.length && !node.async) {
    out.push('@return on a function that returns nothing');
  }
  if (returns.some((t) => !t.type)) out.push('no {type} on @return');
  return out;
}

/**
 * Lists what is wrong with the doc of one function.
 *
 * @param {?Object} comment Its JSDoc comment, or null.
 * @param {!Object} node The function.
 * @param {!Array<string>} forbidden Tags that may not appear.
 * @return {!Array<string>} What is wrong; empty when the doc is right.
 */
function docProblems(comment, node, forbidden) {
  if (!comment) return ['no JSDoc comment'];
  const doc = readDoc(comment.value);
  const out = doc.summary ? [] : ['no summary sentence'];
  for (const tag of doc.tags) {
    if (forbidden.includes(tag.tag)) out.push(`no @${tag.tag}: git keeps that`);
  }
  return [
    ...out,
    ...paramProblems(doc.tags, paramNames(node)),
    ...returnProblems(doc.tags, node)
  ];
}

/**
 * Checks every named function of one file.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @param {!Array<string>} forbidden Tags that may not appear.
 * @return {!Array<!Object>} One finding for each problem.
 */
function checkSource(file, source, forbidden) {
  const { ast, comments } = parse(source);
  const out = [];
  walk.fullAncestor(ast, (node, _state, ancestors) => {
    if (!FUNCTION.test(node.type)) return;
    const anchor = anchorOf(node, ancestors);
    if (!anchor) return;
    const line = node.loc.start.line;
    const comment = docBefore(anchor, comments, source);
    for (const message of docProblems(comment, node, forbidden)) {
      out.push({ file, line, rule: 'jsdoc', message });
    }
  });
  return out;
}

/**
 * Checks the JSDoc of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each problem.
 */
function check(root, files, config) {
  return select(files, config.jsdoc).flatMap((file) =>
    checkSource(file, read(root, file), config.jsdoc.forbiddenTags)
  );
}

module.exports = { check, checkSource };
