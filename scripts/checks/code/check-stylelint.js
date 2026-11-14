/**
 * Runs Stylelint over the stylesheets of a run and turns what it reports into
 * findings: the rules of stylelint.config.mjs, colour tokens and the logical
 * sides the Arabic pages need. A staged run without a stylesheet skips it.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { select } = require("../lib/files.js");

const STYLELINT = path.join(
  path.dirname(require.resolve("stylelint/package.json")),
  "bin",
  "stylelint.mjs",
);
const OUTPUT_LIMIT_BYTES = 67_108_864;

/**
 * Turns one Stylelint warning into a finding.
 *
 * @param {string} root The repository root.
 * @param {string} source The absolute path of the stylesheet.
 * @param {!Object} warning What Stylelint reported.
 * @return {{file: string, line: number, rule: string, message: string}} The
 *     finding.
 */
function toFinding(root, source, warning) {
  return {
    file: path.relative(root, source),
    line: warning.line,
    rule: `stylelint/${warning.rule}`,
    message: warning.text.replace(` (${warning.rule})`, ""),
  };
}

/**
 * Checks the stylesheets of a run with Stylelint.
 *
 * @param {string} root The repository root, where stylelint.config.mjs is.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} What Stylelint found.
 */
function check(root, files, config) {
  const covered = select(files, config.stylelint);
  if (!covered.length) return [];
  const run = spawnSync(process.execPath, [STYLELINT, "--formatter=json", ...covered], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: OUTPUT_LIMIT_BYTES,
  });
  const output = run.stdout || run.stderr;
  if (!output.startsWith("[")) throw new Error(`Stylelint did not run: ${output}`);
  return JSON.parse(output).flatMap((result) =>
    result.warnings.map((warning) => toFinding(root, result.source, warning)),
  );
}

module.exports = { check };
