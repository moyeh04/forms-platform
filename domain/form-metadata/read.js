/**
 * How the form metadata reads what it is given: text, own keys, the field
 * of a form that may be missing, and academic years from years and terms.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;

  /** The academic years offered after the current one. */
  var YEARS_AHEAD = 4;

  /** The oldest academic year offered, counted back from this one. */
  var YEARS_BACK = 6;

  /** A term that names its season and year, such as "Fall 2027". */
  var SEASON_TERM = /^(fall|spring|summer)\s+(\d{4})$/i;

  /**
   * Says whether an object has a key of its own.
   *
   * @param {?Object} object The object.
   * @param {string} key The key.
   * @return {boolean} True when the key is the object's own.
   */
  function own(object, key) {
    return Object.keys(object || {}).indexOf(key) !== -1;
  }

  /**
   * Reads a value as trimmed text.
   *
   * @param {*} value The value; null and undefined are empty.
   * @return {string} The text.
   */
  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  /**
   * Reads a field of a form that may be missing.
   *
   * @param {?Object} form The form.
   * @param {string} key The field.
   * @return {*} Its value, or undefined.
   */
  function fieldOf(form, key) {
    return form ? form[key] : undefined;
  }

  /**
   * Writes the academic year that starts in a year.
   *
   * @param {number} start The year it starts.
   * @return {string} The year, as "2027/2028".
   */
  function span(start) {
    return String(start) + '/' + String(start + 1);
  }

  /**
   * Finds the academic year a term belongs to: one it names, the year a
   * season starts, or the year at its end.
   *
   * @param {*} term The term, such as "Spring 2028" or "Term 2027/2028".
   * @return {string} The year, as "2027/2028", or ''.
   */
  function yearFromTerm(term) {
    var value = text(term);
    var academicYear = value.match(/(?:^|\s)(\d{4})\/(\d{4})$/);
    if (academicYear) return academicYear[1] + '/' + academicYear[2];
    var season = value.match(SEASON_TERM);
    var later;
    if (season) {
      later = /^(spring|summer)$/i.test(season[1]) ? -1 : 0;
      return span(parseInt(season[2], 10) + later);
    }
    var match = value.match(/(?:^|\s)(\d{4})$/);
    return match ? match[1] + '/' + (parseInt(match[1], 10) + 1) : '';
  }

  /**
   * Lists the academic years a form can be for: this one, the last one,
   * the next few and the older ones. A year the form already has comes
   * first when it is not in the list.
   *
   * @param {*=} current The year the form has.
   * @return {!Array<string>} The years, as "2027/2028".
   */
  function academicYears(current) {
    var year = new Date().getFullYear();
    var years = [span(year), span(year - 1)];
    var y;
    for (y = year + 1; y <= year + YEARS_AHEAD; y++) years.push(span(y));
    for (y = year - 2; y >= year - YEARS_BACK; y--) years.push(span(y));
    if (current && years.indexOf(String(current)) === -1) {
      years.unshift(String(current));
    }
    return years;
  }

  /**
   * Reads an academic year from a year or a term.
   *
   * @param {*} value A year, such as "2027", or a term.
   * @return {string} The academic year, as "2027/2028", or ''.
   */
  function academicYear(value) {
    var year = text(value).match(/^(\d{4})$/);
    return year
      ? year[1] + '/' + (parseInt(year[1], 10) + 1)
      : yearFromTerm(value);
  }

  /**
   * Reads the batch year of an older form that kept it as a term, where
   * every season but fall belongs to the year before.
   *
   * @param {*} term The term.
   * @return {string} The academic year, or ''.
   */
  function legacyAcademicYear(term) {
    var match = text(term).match(SEASON_TERM);
    if (!match) return academicYear(term);
    var back = match[1].toLowerCase() === 'fall' ? 0 : -1;
    return span(parseInt(match[2], 10) + back);
  }

  var api = {
    own: own,
    text: text,
    fieldOf: fieldOf,
    academicYears: academicYears,
    academicYear: academicYear,
    legacyAcademicYear: legacyAcademicYear
  };
  if (node) module.exports = api;
  root.FormMetadataRead = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
