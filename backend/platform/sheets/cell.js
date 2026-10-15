/**
 * Yes/no values as the sheets store them. A flag cell holds '1' for yes and
 * '0', or for some columns an empty cell, for no. Only this file reads or
 * writes those strings; everywhere else a flag is a boolean.
 */

var Cell = (function () {
  var YES_ = '1';
  var NO_ = '0';

  /**
   * Reads a flag cell. A cell that holds neither yes nor no, because it is
   * empty, missing from an older row, or legacy text such as 'TRUE', reads as
   * the column's default.
   *
   * @param {*} cell The value of the cell.
   * @param {boolean} whenAbsent What a cell that holds neither means.
   * @return {boolean} The flag.
   */
  function readFlag(cell, whenAbsent) {
    var text = String(cell);
    if (text === YES_) return true;
    if (text === NO_) return false;
    return whenAbsent;
  }

  /**
   * Writes a flag cell.
   *
   * @param {*} value The flag; any truthy value is yes.
   * @param {string} falseCell What the column stores for no: '0', or '' for a
   *     column where only yes is written.
   * @return {string} The cell.
   */
  function writeFlag(value, falseCell) {
    return value ? YES_ : falseCell;
  }

  return { readFlag, writeFlag };
})();
