/**
 * The metadata of a WhatsApp registration: the batch year, also read from
 * the term an older form kept it in.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var read = node ? require('./read.js') : root.FormMetadataRead;
  var own = read.own;
  var fieldOf = read.fieldOf;
  var academicYears = read.academicYears;
  var academicYear = read.academicYear;

  /**
   * Reads the batch year of a form, or of its older term.
   *
   * @param {?Object} form The form.
   * @return {string} The academic year, or ''.
   */
  function batchYear(form) {
    return (
      academicYear(fieldOf(form, 'batchYear')) ||
      academicYear(fieldOf(form, 'term'))
    );
  }

  /**
   * Gives the batch year of a form as an object.
   *
   * @param {?Object} form The form.
   * @return {{batchYear: string}} The year.
   */
  function batchRead(form) {
    return { batchYear: batchYear(form) };
  }

  /**
   * Gives the batch year a new form starts with.
   *
   * @return {{batchYear: string}} This academic year.
   */
  function batchDefaults() {
    return { batchYear: academicYears()[0] };
  }

  /**
   * Gives the batch year of a new form, from a year or an older term.
   *
   * @param {!Object} values What the admin typed.
   * @return {{term: string, batchYear: string}} No term, and the year.
   */
  function batchCreate(values) {
    return {
      term: '',
      batchYear: academicYear(values.batchYear) || academicYear(values.term)
    };
  }

  /**
   * Gives the batch year of a copy: what the admin typed, or the form's.
   *
   * @param {!Object} form The form copied.
   * @param {!Object} values What the admin typed.
   * @return {{term: string, batchYear: string}} No term, and the year.
   */
  function batchDuplicate(form, values) {
    return {
      term: '',
      batchYear: academicYear(values.batchYear) || batchYear(form)
    };
  }

  /**
   * Saves a changed batch year on a form, given as a year or an older term.
   *
   * @param {!Object} form The form; it changes.
   * @param {!Object} patch The changes.
   */
  function batchUpdate(form, patch) {
    if (own(patch, 'batchYear')) {
      form.batchYear = academicYear(patch.batchYear);
    } else if (own(patch, 'term')) {
      form.batchYear = academicYear(patch.term);
    }
  }

  /**
   * Gives the label of a form's batch, its caption and the name of its
   * sheet.
   *
   * @param {?Object} form The form.
   * @return {string} "Batch 2027/2028", or '' when it has no year.
   */
  function batchLabel(form) {
    var year = batchYear(form);
    return year ? 'Batch ' + year : '';
  }

  /**
   * Lists what a form shows beside its title: its batch.
   *
   * @param {?Object} form The form.
   * @return {!Array<{key: string, value: string, variant: string}>} The
   *     label, when it has a year.
   */
  function batchDisplay(form) {
    var label = batchLabel(form);
    return label ? [{ key: 'batchYear', value: label, variant: 'term' }] : [];
  }

  /** The metadata of a WhatsApp registration: its batch year. */
  var batchAdapter = {
    editor: 'batch-year',
    fields: ['batchYear'],
    legacyFields: ['term', 'subject'],
    defaults: batchDefaults,
    read: batchRead,
    create: batchCreate,
    duplicate: batchDuplicate,
    update: batchUpdate,
    public: batchRead,
    display: batchDisplay,
    caption: batchLabel,
    slug: batchYear,
    sheet: batchLabel
  };

  var api = batchAdapter;
  if (node) module.exports = api;
  root.FormMetadataBatch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
