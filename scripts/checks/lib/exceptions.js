/**
 * Exceptions: a path that may break one structure rule, with the reason.
 * An exception with a weak reason, or one that no longer matches anything,
 * fails, so the list cannot hide a problem or outlive its fix.
 */

const MIN_REASON_WORDS = 4;
const WEAK_REASONS = ['allow', 'exception', 'legacy', 'needed', 'todo'];

/**
 * Says whether an exception covers a finding.
 *
 * @param {{path: string, rule: string}} exception One entry.
 * @param {{file: string, rule: string}} finding One finding.
 * @return {boolean} True when the path and the rule both match.
 */
function covers(exception, finding) {
  return exception.path === finding.file && exception.rule === finding.rule;
}

/**
 * Lists the entries whose reason is too short or says nothing.
 *
 * @param {!Array<{path: string, rule: string, reason: string}>} exceptions
 *     The entries.
 * @return {!Array<string>} One line for each weak entry.
 */
function weakReasons(exceptions) {
  return exceptions
    .filter((entry) => {
      const words = String(entry.reason || '')
        .trim()
        .split(/\s+/);
      const weak = words.every((word) =>
        WEAK_REASONS.includes(word.toLowerCase())
      );
      return words.length < MIN_REASON_WORDS || weak;
    })
    .map(
      (entry) => `${entry.path}: the ${entry.rule} exception needs a reason`
    );
}

/**
 * Removes the findings an exception covers, and lists the exceptions that
 * cover nothing.
 *
 * @param {!Array<!Object>} findings What the checks found.
 * @param {!Array<{path: string, rule: string, reason: string}>} exceptions
 *     The entries.
 * @return {{kept: !Array<!Object>, unused: !Array<string>}} The findings left,
 *     and one line for each entry that matched nothing.
 */
function apply(findings, exceptions) {
  const kept = findings.filter(
    (finding) => !exceptions.some((entry) => covers(entry, finding))
  );
  const unused = exceptions
    .filter((entry) => !findings.some((finding) => covers(entry, finding)))
    .map(
      (entry) => `${entry.path}: the ${entry.rule} exception matches nothing`
    );
  return { kept, unused };
}

module.exports = { apply, weakReasons };
