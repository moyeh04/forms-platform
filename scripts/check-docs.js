#!/usr/bin/env node
/**
 * Checks the two places where a document repeats a fact of the code, so neither can go stale:
 *   docs/backend/API.md      names exactly the actions the backend has
 *   docs/process/TESTING.md  gives the number of tests, in total and for each test file
 * The pre-commit hook runs it and refuses the commit while they differ.
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..');

/* ── API reference ─────────────────────────────────────────────── */

function backendActions(root) {
  const dir = path.join(root, 'backend');
  const found = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.gs'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const match of source.matchAll(/^API(?:\['([A-Za-z.]+)'\]|\.([A-Za-z]+)) = /gm)) found.push(match[1] || match[2]);
  }
  return found.sort();
}

function documentedActions(root) {
  const page = fs.readFileSync(path.join(root, 'docs/backend/API.md'), 'utf8');
  return [...page.matchAll(/^\| `([A-Za-z.]+)` \| (?:yes|no) \|/gm)].map((match) => match[1]).sort();
}

/** What is wrong with the API page, one line for each problem. */
function apiProblems(root = ROOT) {
  const code = backendActions(root), page = documentedActions(root);
  const missing = code.filter((name) => !page.includes(name));
  const extra = page.filter((name) => !code.includes(name));
  const twice = page.filter((name, i) => page.indexOf(name) !== i);
  const out = [];
  if (missing.length) out.push('API.md has no row for: ' + missing.join(', '));
  if (extra.length) out.push('API.md has a row for an action that does not exist: ' + extra.join(', '));
  if (twice.length) out.push('API.md lists twice: ' + twice.join(', '));
  return out;
}

/* ── Test counts ───────────────────────────────────────────────── */

/**
 * How many tests each file in tests/ defines. The files are loaded with a stand-in for
 * node:test that counts the calls and runs no test, so a test made in a loop counts too.
 */
function testCounts(root = ROOT) {
  const dir = path.join(root, 'tests');
  const counts = {};
  const load = Module._load;
  let current = '';
  const counter = new Proxy(function () { counts[current]++; }, { get: () => function () {} });
  Module._load = function (request) {
    return request === 'node:test' ? counter : load.apply(this, arguments);
  };
  try {
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.test.js')).sort()) {
      current = file;
      counts[file] = 0;
      require(path.join(dir, file));
    }
  } finally {
    Module._load = load;
  }
  return counts;
}

/** What is wrong with the numbers in the testing page, one line for each problem. */
function testCountProblems(root = ROOT) {
  const counts = testCounts(root);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const page = fs.readFileSync(path.join(root, 'docs/process/TESTING.md'), 'utf8');
  const out = [];
  const totals = [...page.matchAll(/(\d+) automated tests|# (\d+) tests/g)].map((match) => Number(match[1] || match[2]));
  if (!totals.length) out.push('TESTING.md does not give the number of tests.');
  if (totals.some((n) => n !== total)) out.push('TESTING.md says ' + totals.join(' and ') + ' tests; there are ' + total + '.');
  const rows = {};
  for (const match of page.matchAll(/^\|[^|]+\| `([a-z-]+\.test\.js)` \| (\d+) \|/gm)) rows[match[1]] = Number(match[2]);
  for (const file of Object.keys(counts)) {
    if (!(file in rows)) out.push('TESTING.md has no row for ' + file + ' (' + counts[file] + ' tests).');
    else if (rows[file] !== counts[file]) out.push('TESTING.md gives ' + file + ' ' + rows[file] + ' tests; it has ' + counts[file] + '.');
  }
  for (const file of Object.keys(rows)) if (!(file in counts)) out.push('TESTING.md has a row for ' + file + ', which does not exist.');
  return out;
}

if (require.main === module) {
  const problems = apiProblems().concat(testCountProblems());
  if (problems.length) {
    console.error('The documents do not match the code:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
}

module.exports = { apiProblems, testCountProblems, testCounts };
