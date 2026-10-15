/**
 * Checks that the words of a shared vocabulary are written as enum members.
 * `enums.properties` in the configuration maps a property name to the enum
 * that holds its values, such as `type` to `FormType`. A string compared
 * with that property, or a `case` of a `switch` on it, that is a value of the
 * enum must be written as the member: `form.type === FormType.RESERVATION`,
 * not `form.type === 'reservation'`. A string that is not a value of the enum
 * passes, because the same property names other words too, such as the type
 * of a question.
 */
const path = require('node:path');
const walk = require('acorn-walk');
const { select, read } = require('../lib/files.js');
const { parse } = require('../lib/parse.js');

const EQUALITY = ['===', '!==', '==', '!='];

/**
 * Names the property a member expression reads: `type` for `form.type`, and
 * the outer name for a computed read such as `review` for `r.review[id]`.
 *
 * @param {!Object} node Any node.
 * @return {?string} The property name, or null for any other node.
 */
function propertyOf(node) {
  if (node.type !== 'MemberExpression') return null;
  if (!node.computed) return node.property.name;
  return propertyOf(node.object);
}

/**
 * Finds the member of an enum that a string stands for.
 *
 * @param {!Object} node Any node.
 * @param {string} property The property the string is compared with.
 * @param {!Object} rules The property map and the loaded enums.
 * @return {string} The member, such as `FormType.RESERVATION`, or an empty
 *     string when the node is not a value of the property's enum.
 */
function memberFor(node, property, rules) {
  const name = rules.properties[property];
  if (!name || node.type !== 'Literal' || typeof node.value !== 'string') {
    return '';
  }
  const members = rules.enums[name] || {};
  const key = Object.keys(members).find((k) => members[k] === node.value);
  return key ? `${name}.${key}` : '';
}

/**
 * Lists the strings one node compares with a mapped property.
 *
 * @param {!Object} node Any node.
 * @param {!Object} rules The property map and the loaded enums.
 * @return {!Array<{node: !Object, member: string}>} Each string and the
 *     member to write instead.
 */
function stringsOf(node, rules) {
  const pairs = [];
  if (node.type === 'BinaryExpression' && EQUALITY.includes(node.operator)) {
    pairs.push([node.left, node.right], [node.right, node.left]);
  }
  if (node.type === 'SwitchStatement') {
    for (const branch of node.cases) {
      if (branch.test) pairs.push([branch.test, node.discriminant]);
    }
  }
  return pairs
    .map(([text, other]) => ({
      node: text,
      member: memberFor(text, propertyOf(other), rules)
    }))
    .filter((found) => found.member);
}

/**
 * Checks the enum words of one file.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @param {!Object} rules The property map and the loaded enums.
 * @return {!Array<!Object>} One finding for each word written by hand.
 */
function checkSource(file, source, rules) {
  const out = [];
  walk.full(parse(source).ast, (node) => {
    for (const found of stringsOf(node, rules)) {
      out.push({
        file,
        line: found.node.loc.start.line,
        rule: 'enums',
        message: `write ${found.member}, not '${found.node.value}'`
      });
    }
  });
  return out;
}

/**
 * Checks the enum words of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each word written by hand.
 */
function check(root, files, config) {
  const rules = {
    properties: config.enums.properties,
    enums: require(path.join(root, config.enums.source))
  };
  return select(files, config.enums).flatMap((file) =>
    checkSource(file, read(root, file), rules)
  );
}

module.exports = { check, checkSource };
