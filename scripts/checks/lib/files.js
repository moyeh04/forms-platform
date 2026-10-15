/** Picks the files a run of the checks looks at. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Lists the tracked files, or only the staged ones, that exist on disk.
 *
 * @param {string} root The repository root.
 * @param {boolean} staged True for the files staged for the next commit.
 * @return {!Array<string>} Paths relative to the root, with forward slashes.
 */
function listFiles(root, staged) {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['ls-files'];
  const out = execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  return out
    .split('\n')
    .filter((file) => file && fs.existsSync(path.join(root, file)));
}

/**
 * Keeps the files a rule covers: under one of its folders, with one of its
 * extensions, and not named in its exclusions.
 *
 * @param {!Array<string>} files Paths relative to the root.
 * @param {{include: !Array<string>, extensions: !Array<string>,
 *     exclude: (!Array<string>|undefined)}} scope What the rule covers.
 * @return {!Array<string>} The covered paths.
 */
function select(files, scope) {
  const exclude = scope.exclude || [];
  return files.filter(
    (file) =>
      scope.include.some((dir) => file.startsWith(dir)) &&
      scope.extensions.includes(path.extname(file)) &&
      !exclude.some((skip) => file.startsWith(skip))
  );
}

/**
 * Reads a file of the repository as text.
 *
 * @param {string} root The repository root.
 * @param {string} file A path relative to the root.
 * @return {string} The content.
 */
function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

module.exports = { listFiles, select, read };
