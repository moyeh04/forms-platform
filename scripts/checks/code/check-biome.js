/**
 * Runs Biome over the files of a run and turns what it reports into
 * findings: formatting, lint rules and the size limits of biome.json.
 * Suggestions Biome marks as "info" are left out.
 */
const { spawnSync } = require('node:child_process');
const { select } = require('../lib/files.js');

const BIOME = require.resolve('@biomejs/biome/bin/biome');
const FILES_PER_CALL = 200;
const OUTPUT_LIMIT_BYTES = 268_435_456;

/**
 * Runs Biome on some files and returns its diagnostics.
 *
 * @param {string} root The repository root, where biome.json is.
 * @param {!Array<string>} files Paths relative to the root.
 * @return {!Array<!Object>} Biome's diagnostics.
 */
function diagnose(root, files) {
  const args = [
    BIOME,
    'check',
    '--reporter=json',
    '--max-diagnostics=none',
    '--files-ignore-unknown=true',
    '--no-errors-on-unmatched',
    ...files
  ];
  const run = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: OUTPUT_LIMIT_BYTES
  });
  if (!run.stdout) throw new Error(`Biome did not run: ${run.stderr}`);
  return JSON.parse(run.stdout).diagnostics;
}

/**
 * Turns one Biome diagnostic into a finding.
 *
 * @param {!Object} diagnostic What Biome reported.
 * @return {{file: string, line: number, rule: string, message: string}} The
 *     finding.
 */
function toFinding(diagnostic) {
  const start = diagnostic.location.start;
  return {
    file: diagnostic.location.path,
    line: start ? start.line : 0,
    rule: `biome/${diagnostic.category}`,
    message: diagnostic.message.split('\n')[0]
  };
}

/**
 * Checks the files of a run with Biome.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} What Biome found.
 */
function check(root, files, config) {
  const covered = select(files, config.biome);
  const findings = [];
  for (let i = 0; i < covered.length; i += FILES_PER_CALL) {
    const part = covered.slice(i, i + FILES_PER_CALL);
    for (const diagnostic of diagnose(root, part)) {
      if (diagnostic.severity !== 'info') findings.push(toFinding(diagnostic));
    }
  }
  return findings;
}

module.exports = { check };
