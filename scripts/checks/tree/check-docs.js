/**
 * Checks the documents against the code: API.md names exactly the actions
 * the backend has, each under the section of its access, TESTING.md gives
 * the right number of tests in total and for each test file, and no Markdown
 * link points at a file that is gone.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { select, read } = require('../lib/files.js');

const ROUTE = /\baction: '([A-Za-z.]+)',\s*access: Access\.([A-Z]+)/g;
const SECTION = /^## (.*)$/;
const API_ROW = /^\| `([A-Za-z.]+)` \| (?:yes|no) \|/gm;
const TEST_ROW = /^\|[^|]+\| `([a-z0-9/._-]+\.test\.js)` \| (\d+) \|/gm;
const TOTAL = /(\d+) automated tests|# (\d+) tests/g;
const LINK = /\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g;

/**
 * Makes one finding about a document.
 *
 * @param {string} file The document.
 * @param {string} message What is wrong.
 * @return {{file: string, line: number, rule: string, message: string}} The
 *     finding.
 */
function finding(file, message) {
  return { file, line: 0, rule: 'docs', message };
}

/**
 * Reads the rows of API.md, each with the access of the section it is in.
 * A section whose heading starts with a key of `sections` holds the actions
 * of that access.
 *
 * @param {string} text The text of API.md.
 * @param {!Object<string, string>} sections Heading starts and the access
 *     each one stands for.
 * @return {!Map<string, ?string>} Each action and the access of its section,
 *     or null when its section names none.
 */
function pageRows(text, sections) {
  const rows = new Map();
  let access = null;
  for (const line of text.split('\n')) {
    const heading = SECTION.exec(line);
    if (heading) {
      const start = Object.keys(sections).find((s) => heading[1].startsWith(s));
      access = start ? sections[start] : null;
    }
    for (const match of line.matchAll(API_ROW)) rows.set(match[1], access);
  }
  return rows;
}

/**
 * Lists the actions of the backend's routes table and the ones API.md names.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The `docs` part of the checks configuration.
 * @return {{code: !Map<string, string>, page: !Array<string>,
 *     sections: !Map<string, ?string>}} The access of each route, the
 *     actions API.md names, sorted, and the access of the section of each.
 */
function actions(root, files, config) {
  const code = new Map();
  for (const file of select(files, config.backend)) {
    for (const match of read(root, file).matchAll(ROUTE)) {
      code.set(match[1], match[2]);
    }
  }
  const text = read(root, config.api);
  const page = [...text.matchAll(API_ROW)].map((m) => m[1]);
  const sections = pageRows(text, config.accessSections || {});
  return { code, page: page.sort(), sections };
}

/**
 * Compares the actions of the backend with the rows of API.md.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The `docs` part of the checks configuration.
 * @return {!Array<!Object>} One finding for each difference.
 */
function apiFindings(root, files, config) {
  const { code, page, sections } = actions(root, files, config);
  const names = [...code.keys()].sort();
  const missing = names.filter((name) => !page.includes(name));
  const extra = page.filter((name) => !code.has(name));
  const twice = page.filter((name, i) => page.indexOf(name) !== i);
  const misplaced = names.filter(
    (name) => sections.has(name) && sections.get(name) !== code.get(name)
  );
  const out = [];
  if (missing.length) out.push(`no row for ${missing.join(', ')}`);
  if (extra.length) out.push(`a row for a missing action: ${extra.join(', ')}`);
  if (twice.length) out.push(`listed twice: ${twice.join(', ')}`);
  for (const name of misplaced) {
    const access = `Access.${code.get(name)}`;
    out.push(`${name} is in the section of another access than ${access}`);
  }
  return out.map((message) => finding(config.api, message));
}

/**
 * Makes a stand-in for node:test that counts calls to it and runs nothing.
 *
 * @param {function()} count Called once for each test.
 * @return {!Function} The stand-in.
 */
function standInForTest(count) {
  return new Proxy(count, { get: () => () => {} });
}

/**
 * Wraps Node's module loader so one module name loads a given value instead.
 *
 * @param {!Function} load Node's own `Module._load`.
 * @param {string} name The module to replace.
 * @param {*} value What `require(name)` returns.
 * @return {!Function} The wrapped loader.
 */
function loaderWith(load, name, value) {
  return function (request, ...rest) {
    return request === name ? value : load.call(this, request, ...rest);
  };
}

/**
 * Counts the tests each test file defines. The files are loaded with a
 * stand-in for node:test that counts calls and runs nothing, so a test made
 * in a loop counts too.
 *
 * @param {string} dir The tests folder, absolute.
 * @return {!Object<string, number>} Count per file, relative to the folder.
 */
function testCounts(dir) {
  const files = fs
    .readdirSync(dir, { recursive: true })
    .map((file) => file.split(path.sep).join('/'))
    .filter((file) => file.endsWith('.test.js'))
    .sort();
  const counts = {};
  const load = Module._load;
  let current = '';
  const counter = standInForTest(() => {
    counts[current]++;
  });
  Module._load = loaderWith(load, 'node:test', counter);
  try {
    for (const file of files) {
      current = file;
      counts[file] = 0;
      require(path.join(dir, file));
    }
  } finally {
    Module._load = load;
  }
  return counts;
}

/**
 * Compares the test counts with the totals and rows of TESTING.md.
 *
 * @param {string} root The repository root.
 * @param {!Object} config The `docs` part of the checks configuration.
 * @return {!Array<!Object>} One finding for each difference.
 */
function testFindings(root, config) {
  const counts = testCounts(path.join(root, config.tests));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const page = read(root, config.testing);
  const totals = [...page.matchAll(TOTAL)].map((m) => Number(m[1] || m[2]));
  const rows = {};
  for (const m of page.matchAll(TEST_ROW)) rows[m[1]] = Number(m[2]);
  const out = [];
  if (totals.some((n) => n !== total) || !totals.length) {
    out.push(
      `gives ${totals.join(' and ')} tests in total; there are ${total}`
    );
  }
  for (const [file, count] of Object.entries(counts)) {
    if (!(file in rows)) out.push(`no row for ${file} (${count} tests)`);
    else if (rows[file] !== count) {
      out.push(`gives ${file} ${rows[file]} tests; it has ${count}`);
    }
  }
  for (const file of Object.keys(rows)) {
    if (!(file in counts)) out.push(`a row for ${file}, which does not exist`);
  }
  return out.map((message) => finding(config.testing, message));
}

/**
 * Finds relative Markdown links whose target does not exist.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @return {!Array<!Object>} One finding for each broken link.
 */
function linkFindings(root, files) {
  const out = [];
  for (const file of files.filter((name) => name.endsWith('.md'))) {
    for (const match of read(root, file).matchAll(LINK)) {
      const target = match[1];
      if (/^[a-z]+:/.test(target)) continue;
      const resolved = path.join(root, path.dirname(file), target);
      if (!fs.existsSync(resolved)) {
        out.push(finding(file, `links to ${target}, which does not exist`));
      }
    }
  }
  return out;
}

/**
 * Runs every document check.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} What is wrong.
 */
function check(root, files, config) {
  return [
    ...apiFindings(root, files, config.docs),
    ...testFindings(root, config.docs),
    ...linkFindings(root, files)
  ];
}

module.exports = { check, testCounts, wholeTree: true };
