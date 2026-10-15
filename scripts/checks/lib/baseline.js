/**
 * The baseline: how many findings of each rule a legacy file may still have.
 * A count may only go down, so old code is fixed file by file and new code
 * is held to every rule from the start.
 */

/**
 * One thing a check found wrong.
 *
 * @typedef {{file: string, line: number, rule: string, message: string}}
 *     Finding
 */

/**
 * Counts findings by file and rule.
 *
 * @param {!Array<!Finding>} findings What the checks found.
 * @return {!Object<string, !Object<string, number>>} Count per file and rule.
 */
function countFindings(findings) {
  const counts = {};
  for (const finding of findings) {
    if (!counts[finding.file]) counts[finding.file] = {};
    const byRule = counts[finding.file];
    byRule[finding.rule] = (byRule[finding.rule] || 0) + 1;
  }
  return counts;
}

/**
 * Splits the findings into those the baseline allows and those it does not,
 * and lists the baseline entries that are higher than what is left.
 *
 * @param {!Array<!Finding>} findings What the checks found.
 * @param {!Object<string, !Object<string, number>>} baseline Allowed counts.
 * @param {!Array<string>} checked The files this run looked at.
 * @return {{failures: !Array<!Finding>, stale: !Array<string>}} Findings over
 *     the baseline, and one line for each count that must be lowered.
 */
function judge(findings, baseline, checked) {
  const counts = countFindings(findings);
  const failures = findings.filter((finding) => {
    const allowed = baseline[finding.file]?.[finding.rule] || 0;
    return counts[finding.file][finding.rule] > allowed;
  });
  const stale = [];
  for (const file of checked) {
    for (const [rule, allowed] of Object.entries(baseline[file] || {})) {
      const left = counts[file]?.[rule] || 0;
      if (left < allowed) {
        stale.push(`${file}: ${rule} is down to ${left} from ${allowed}`);
      }
    }
  }
  return { failures, stale };
}

/**
 * Lists the baseline entries of files that no longer exist.
 *
 * @param {!Object<string, !Object<string, number>>} baseline Allowed counts.
 * @param {!Array<string>} files Every tracked file.
 * @return {!Array<string>} One line for each file that is gone.
 */
function goneFiles(baseline, files) {
  return Object.keys(baseline)
    .filter((file) => !files.includes(file))
    .map((file) => `${file}: in the baseline but no longer tracked`);
}

/**
 * Lowers the baseline to what is left. It never raises a count.
 *
 * @param {!Object<string, !Object<string, number>>} baseline Allowed counts.
 * @param {!Array<!Finding>} findings What the checks found.
 * @param {!Array<string>} checked The files this run looked at.
 * @return {!Object<string, !Object<string, number>>} The lowered baseline.
 */
function lower(baseline, findings, checked) {
  const counts = countFindings(findings);
  const out = {};
  for (const [file, rules] of Object.entries(baseline)) {
    for (const [rule, allowed] of Object.entries(rules)) {
      const left = checked.includes(file)
        ? Math.min(allowed, counts[file]?.[rule] || 0)
        : allowed;
      if (left === 0) continue;
      if (!out[file]) out[file] = {};
      out[file][rule] = left;
    }
  }
  return out;
}

module.exports = { countFindings, judge, goneFiles, lower };
