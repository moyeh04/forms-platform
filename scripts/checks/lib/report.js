/** Prints what the checks found, one line per finding. */

/**
 * Formats one finding as `file:line  rule  message`.
 *
 * @param {{file: string, line: number, rule: string, message: string}}
 *     finding One finding.
 * @return {string} The line.
 */
function formatFinding(finding) {
  const where = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  return `${where}  ${finding.rule}  ${finding.message}`;
}

/**
 * Prints a titled block of lines to stderr, or nothing when there are none.
 *
 * @param {string} title What the lines are.
 * @param {!Array<string>} lines The lines.
 * @return {number} How many lines were printed.
 */
function printBlock(title, lines) {
  if (lines.length === 0) return 0;
  console.error(`${title}\n  ${lines.join('\n  ')}`);
  return lines.length;
}

module.exports = { formatFinding, printBlock };
