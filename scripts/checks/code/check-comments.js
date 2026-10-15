/**
 * Checks the comments of the files that are not JavaScript: the git hooks,
 * the shell scripts and the CI workflows. A shell file says what it does and
 * when it runs in a comment block under its `#!` line. A workflow starts with
 * a comment that says what it runs and when, and every job has a comment
 * line above it that says why it exists or why it runs when it does
 * ([DOCUMENTATION.md](../../../docs/standards/DOCUMENTATION.md)).
 */
const path = require('node:path');
const { select, read } = require('../lib/files.js');

/** A job of a workflow: a key indented one level under `jobs:`. */
const JOB = /^ {2}([\w-]+):\s*$/;

/**
 * Says whether a line is a comment.
 *
 * @param {string|undefined} line The line.
 * @return {boolean} True for a `#` comment.
 */
function isComment(line) {
  return Boolean(line?.trim().startsWith('#'));
}

/**
 * Makes a finding of this check.
 *
 * @param {string} file The path of the file.
 * @param {number} line The line, from 1.
 * @param {string} message What is missing.
 * @return {!Object} The finding.
 */
function finding(file, line, message) {
  return { file, line, rule: 'comments', message };
}

/**
 * Checks the header of a shell file.
 *
 * @param {string} file The path of the file.
 * @param {!Array<string>} lines Its lines.
 * @return {!Array<!Object>} A finding when it has no header comment.
 */
function checkShell(file, lines) {
  const first = lines[0].startsWith('#!') ? 1 : 0;
  if (isComment(lines[first]) && !lines[first].startsWith('#!')) return [];
  return [
    finding(
      file,
      first + 1,
      'no comment saying what the script does and when it runs'
    )
  ];
}

/**
 * Checks the header of a workflow and the comment above each of its jobs.
 *
 * @param {string} file The path of the file.
 * @param {!Array<string>} lines Its lines.
 * @return {!Array<!Object>} One finding for each missing comment.
 */
function checkWorkflow(file, lines) {
  const out = [];
  if (!isComment(lines[0])) {
    out.push(
      finding(file, 1, 'no comment saying what the workflow runs and when')
    );
  }
  let inJobs = false;
  lines.forEach((line, i) => {
    if (/^\S/.test(line)) inJobs = line.startsWith('jobs:');
    const job = inJobs && JOB.exec(line);
    if (job && !isComment(lines[i - 1])) {
      const why = `job ${job[1]} has no comment saying why it runs`;
      out.push(finding(file, i + 1, why));
    }
  });
  return out;
}

/**
 * Checks the comments of one file.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @return {!Array<!Object>} One finding for each missing comment.
 */
function checkSource(file, source) {
  const lines = source.split('\n');
  const ext = path.extname(file);
  if (ext === '.yml' || ext === '.yaml') return checkWorkflow(file, lines);
  return checkShell(file, lines);
}

/**
 * Checks the comments of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each missing comment.
 */
function check(root, files, config) {
  return select(files, config.comments).flatMap((file) =>
    checkSource(file, read(root, file))
  );
}

module.exports = { check, checkSource };
