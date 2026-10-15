/**
 * Checks the documents against the code: API.md names exactly the actions
 * the backend has, TESTING.md gives the right number of tests in total and
 * for each test file, and no Markdown link points at a file that is gone.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { select, read } = require('./lib/files.js');

const ACTION = /^API(?:\['([A-Za-z.]+)'\]|\.([A-Za-z]+)) = /gm;
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
 * Lists the actions the backend defines and the ones API.md names.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files Every tracked file.
 * @param {!Object} config The `docs` part of the checks configuration.
 * @return {{code: !Array<string>, page: !Array<string>}} Both lists, sorted.
 */
function actions(root, files, config) {
  const code = [];
  for (const file of select(files, config.backend)) {
    for (const match of read(root, file).matchAll(ACTION)) {
      code.push(match[1] || match[2]);
    }
  }
  const page = [...read(root, config.api).matchAll(API_ROW)].map((m) => m[1]);
  return { code: code.sort(), page: page.sort() };
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
  const { code, page } = actions(root, files, config);
  const missing = code.filter((name) => !page.includes(name));
  const extra = page.filter((name) => !code.includes(name));
  const twice = page.filter((name, i) => page.indexOf(name) !== i);
  const out = [];
  if (missing.length) out.push(`no row for ${missing.join(', ')}`);
  if (extra.length) out.push(`a row for a missing action: ${extra.join(', ')}`);
  if (twice.length) out.push(`listed twice: ${twice.join(', ')}`);
  return out.map((message) => finding(config.api, message));
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
  const counter = new Proxy(
    () => {
      counts[current]++;
    },
    { get: () => () => {} }
  );
  Module._load = function (request, ...rest) {
    return request === 'node:test'
      ? counter
      : load.call(this, request, ...rest);
  };
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
