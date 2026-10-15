/**
 * Checks that backend code calls only the layers it may. Each backend file
 * defines one namespace named after it (`forms.repository.js` defines
 * `FormsRepository`), so a read such as `FormsRepository.readForms` shows
 * which file it reaches. `layers.rules` in the configuration says, for the
 * files a pattern matches, which files they may not reach and why: platform
 * code reads no feature, and a controller asks its service, never a
 * repository.
 */
const path = require('node:path');
const walk = require('acorn-walk');
const { select, read } = require('../lib/files.js');
const { parse } = require('../lib/parse.js');

/**
 * Gives the namespace a backend file defines: its name in PascalCase.
 *
 * @param {string} file The path of the file.
 * @return {string} The namespace, such as `FormsRepository`.
 */
function namespaceOf(file) {
  return path
    .basename(file, '.js')
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/**
 * Lists the namespaces each rule forbids, with the file of each.
 *
 * @param {!Array<!Object>} rules The rules: files, mayNotUse and why.
 * @param {!Array<string>} backend Every backend file of the tree.
 * @return {!Array<!Object>} Each rule with `forbidden`, a map from a
 *     namespace to its file.
 */
function compile(rules, backend) {
  return rules.map((rule) => {
    const forbidden = new Map();
    for (const file of backend) {
      if (new RegExp(rule.mayNotUse).test(file)) {
        forbidden.set(namespaceOf(file), file);
      }
    }
    return { ...rule, files: new RegExp(rule.files), forbidden };
  });
}

/**
 * Checks the namespaces one file reads.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @param {!Array<!Object>} rules The compiled rules.
 * @return {!Array<!Object>} One finding for each forbidden read.
 */
function checkSource(file, source, rules) {
  const apply = rules.filter((rule) => rule.files.test(file));
  if (!apply.length) return [];
  const out = [];
  walk.full(parse(source).ast, (node) => {
    if (node.type !== 'MemberExpression' || node.object.type !== 'Identifier') {
      return;
    }
    for (const rule of apply) {
      const home = rule.forbidden.get(node.object.name);
      if (!home || home === file) continue;
      out.push({
        file,
        line: node.loc.start.line,
        rule: 'layers',
        message: `${node.object.name} is in ${home}; ${rule.why}`
      });
    }
  });
  return out;
}

/**
 * Checks the layers of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @param {!Array<string>} tracked Every tracked file, for the namespaces.
 * @return {!Array<!Object>} One finding for each forbidden read.
 */
function check(root, files, config, tracked) {
  const rules = compile(
    config.layers.rules,
    select(tracked || files, config.layers)
  );
  return select(files, config.layers).flatMap((file) =>
    checkSource(file, read(root, file), rules)
  );
}

module.exports = { check, checkSource, compile };
