/**
 * Runs Oxfmt over the files of a run and reports each one it would lay out
 * differently. `pnpm fmt` lays them out.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { select } = require("../lib/files.js");

const OXFMT = path.join(path.dirname(require.resolve("oxfmt/package.json")), "bin", "oxfmt");
const FILES_PER_CALL = 200;

/**
 * Lists the files Oxfmt would change.
 *
 * @param {string} root The repository root, where .oxfmtrc.json is.
 * @param {!Array<string>} files Paths relative to the root.
 * @return {!Array<string>} The files that are not laid out.
 */
function different(root, files) {
  const args = [OXFMT, "--list-different", "--no-error-on-unmatched-pattern", ...files];
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  if (run.status !== 0 && run.status !== 1) throw new Error(`Oxfmt did not run: ${run.stderr}`);
  return run.stdout.split("\n").filter(Boolean);
}

/**
 * Checks the layout of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each file Oxfmt would change.
 */
function check(root, files, config) {
  const covered = select(files, config.oxfmt);
  const findings = [];
  for (let i = 0; i < covered.length; i += FILES_PER_CALL) {
    for (const file of different(root, covered.slice(i, i + FILES_PER_CALL))) {
      findings.push({ file, line: 0, rule: "oxfmt", message: "not laid out; run pnpm fmt" });
    }
  }
  return findings;
}

module.exports = { check };
