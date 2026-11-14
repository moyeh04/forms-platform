/**
 * Runs Oxlint over the JavaScript files of a run and turns what it reports
 * into findings: the rules and size limits of .oxlintrc.json. A full run is
 * type-aware, so it also catches an unawaited promise or a misused one; a
 * staged run (the pre-commit hook) leaves the type checker out to stay fast.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { select } = require("../lib/files.js");

const OXLINT = path.join(path.dirname(require.resolve("oxlint/package.json")), "bin", "oxlint");
const FILES_PER_CALL = 200;
const OUTPUT_LIMIT_BYTES = 268_435_456;

/**
 * Runs Oxlint on some files and returns its diagnostics.
 *
 * @param {string} root The repository root, where .oxlintrc.json is.
 * @param {!Array<string>} files Paths relative to the root.
 * @param {boolean} typeAware True to run the rules that need types.
 * @return {!Array<!Object>} Oxlint's diagnostics.
 */
function diagnose(root, files, typeAware) {
  const args = [OXLINT, "--format=json", ...(typeAware ? ["--type-aware"] : []), ...files];
  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: OUTPUT_LIMIT_BYTES,
  });
  if (!run.stdout) throw new Error(`Oxlint did not run: ${run.stderr}`);
  return JSON.parse(run.stdout).diagnostics;
}

/**
 * Turns one Oxlint diagnostic into a finding. A rule `eslint(max-lines)`
 * becomes `oxlint/eslint/max-lines`.
 *
 * @param {!Object} diagnostic What Oxlint reported.
 * @return {{file: string, line: number, rule: string, message: string}} The
 *     finding.
 */
function toFinding(diagnostic) {
  const label = diagnostic.labels[0];
  return {
    file: diagnostic.filename,
    line: label ? label.span.line : 0,
    rule: `oxlint/${diagnostic.code.replace(/\((.*)\)$/, "/$1")}`,
    message: diagnostic.message,
  };
}

/**
 * Checks the files of a run with Oxlint.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration; `run.staged` is true on
 *     the staged run.
 * @return {!Array<!Object>} What Oxlint found.
 */
function check(root, files, config) {
  const covered = select(files, config.oxlint);
  const typeAware = !config.run?.staged;
  const findings = [];
  for (let i = 0; i < covered.length; i += FILES_PER_CALL) {
    const part = covered.slice(i, i + FILES_PER_CALL);
    for (const diagnostic of diagnose(root, part, typeAware)) {
      findings.push(toFinding(diagnostic));
    }
  }
  return findings;
}

module.exports = { check };
