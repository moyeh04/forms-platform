#!/usr/bin/env node
/**
 * Runs every check of the project and fails when one finds something the
 * baseline and the exceptions do not allow.
 *
 *   node scripts/checks/run-checks.js --staged   the staged files (pre-commit)
 *   node scripts/checks/run-checks.js --all      every tracked file (CI)
 *   ... --update-baseline                        lower the baseline to what
 *                                                is left; it never raises it
 */
const fs = require('node:fs');
const path = require('node:path');
const { listFiles } = require('./lib/files.js');
const baselines = require('./lib/baseline.js');
const exceptions = require('./lib/exceptions.js');
const { formatFinding, printBlock } = require('./lib/report.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = require('./config.json');
const CHECKS = [
  require('./code/check-biome.js'),
  require('./code/check-lines.js'),
  require('./code/check-jsdoc.js'),
  require('./code/check-numbers.js'),
  require('./code/check-flags.js'),
  require('./code/check-enums.js'),
  require('./code/check-layers.js'),
  require('./tree/check-structure.js'),
  require('./tree/check-docs.js')
];

/**
 * Reads a JSON file of the checks folder.
 *
 * @param {string} name The file name.
 * @return {*} The parsed content.
 */
function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

/**
 * Runs every check over the files of this run.
 *
 * @param {!Array<string>} files The files to look at.
 * @param {!Array<string>} tracked Every tracked file.
 * @return {!Array<!Object>} Every finding.
 */
function runAll(files, tracked) {
  return CHECKS.flatMap((check) =>
    check.check(ROOT, check.wholeTree ? tracked : files, CONFIG, tracked)
  );
}

/**
 * Runs the checks, prints what fails, and says whether the run passed.
 *
 * @param {!Array<string>} args The command-line arguments.
 * @return {boolean} True when nothing failed.
 */
function main(args) {
  const staged = args.includes('--staged');
  const tracked = listFiles(ROOT, false);
  const files = staged ? listFiles(ROOT, true) : tracked;
  const allowed = readJson(CONFIG.exceptions);
  const baseline = readJson(CONFIG.baseline);
  const { kept, unused } = exceptions.apply(runAll(files, tracked), allowed);
  if (args.includes('--update-baseline')) {
    const lowered = baselines.lower(baseline, kept, files);
    const text = `${JSON.stringify(lowered, null, 2)}\n`;
    fs.writeFileSync(path.join(__dirname, CONFIG.baseline), text);
  }
  const { failures, stale } = baselines.judge(kept, baseline, files);
  let problems = printBlock('Not allowed:', failures.map(formatFinding));
  problems += printBlock(
    'Fixed, so lower the baseline (npm run check -- --update-baseline):',
    args.includes('--update-baseline') ? [] : stale
  );
  problems += printBlock('Exceptions:', exceptions.weakReasons(allowed));
  if (!staged) {
    problems += printBlock('Out of date:', [
      ...unused,
      ...baselines.goneFiles(baseline, tracked)
    ]);
  }
  return problems === 0;
}

if (require.main === module && !main(process.argv.slice(2))) {
  process.exitCode = 1;
}

module.exports = { main };
