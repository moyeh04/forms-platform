/**
 * Checks that no line is longer than the limit (80 columns, Google §4.4).
 * Biome wraps code but not strings or comments, so this check covers what
 * the formatter leaves. A URL cannot be broken, so it does not count toward
 * the length of its line.
 */
const { select, read } = require('./lib/files.js');

const URL = /https?:\/\/\S+/g;

/**
 * Measures a line in characters, leaving out the URLs it holds.
 *
 * @param {string} line One line of text.
 * @return {number} Its width without URLs.
 */
function width(line) {
  return [...line.replace(URL, '')].length;
}

/**
 * Finds the lines of one text that are over the limit.
 *
 * @param {string} file The path of the text.
 * @param {string} text Its content.
 * @param {number} limit The most columns a line may take.
 * @return {!Array<!Object>} One finding for each long line.
 */
function longLines(file, text, limit) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    const columns = width(line);
    if (columns <= limit) return;
    out.push({
      file,
      line: i + 1,
      rule: 'lines',
      message: `${columns} columns; the limit is ${limit}`
    });
  });
  return out;
}

/**
 * Checks the line length of the files of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each long line.
 */
function check(root, files, config) {
  return select(files, config.lines).flatMap((file) =>
    longLines(file, read(root, file), config.lines.limit)
  );
}

module.exports = { check };
