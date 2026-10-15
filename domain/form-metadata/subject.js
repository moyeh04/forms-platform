/**
 * The metadata of a form with a term and a subject code: team
 * registrations, task submissions and reservations.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var read = node ? require('./read.js') : root.FormMetadataRead;
  var own = read.own;
  var text = read.text;
  var fieldOf = read.fieldOf;
  var academicYears = read.academicYears;

  /** The longest subject code. */
  var MAX_SUBJECT_CODE = 20;

  /**
   * Cleans a subject code: letters, digits and hyphens, no spaces.
   *
   * @param {*} value The typed code.
   * @return {string} The code.
   */
  function subjectCode(value) {
    return text(value)
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9-]/g, '')
      .slice(0, MAX_SUBJECT_CODE);
  }

  /**
   * Reads the term and subject of a form.
   *
   * @param {?Object} form The form.
   * @return {{term: string, subject: string}} The two, as text.
   */
  function subjectTerm(form) {
    return {
      term: text(fieldOf(form, 'term')),
      subject: text(fieldOf(form, 'subject'))
    };
  }

  /**
   * Gives the term and subject a new form starts with.
   *
   * @return {{term: string, subject: string}} Fall of this academic year,
   *     and no subject.
   */
  function subjectDefaults() {
    return { term: 'Fall ' + academicYears()[0], subject: '' };
  }

  /**
   * Gives the term and subject of a new form.
   *
   * @param {!Object} values What the admin typed.
   * @return {{term: string, subject: string}} The cleaned values.
   */
  function subjectCreate(values) {
    return { term: text(values.term), subject: subjectCode(values.subject) };
  }

  /**
   * Gives the term and subject of a copy: what the admin typed, or what the
   * form has.
   *
   * @param {!Object} form The form copied.
   * @param {!Object} values What the admin typed.
   * @return {{term: string, subject: string}} The values of the copy.
   */
  function subjectDuplicate(form, values) {
    return {
      term: own(values, 'term') ? text(values.term) : text(form.term),
      subject: own(values, 'subject')
        ? subjectCode(values.subject)
        : text(form.subject)
    };
  }

  /**
   * Saves a changed term or subject on a form.
   *
   * @param {!Object} form The form; it changes.
   * @param {!Object} patch The changes.
   */
  function subjectUpdate(form, patch) {
    if (own(patch, 'term')) form.term = text(patch.term);
    if (own(patch, 'subject')) form.subject = subjectCode(patch.subject);
  }

  /**
   * Lists what a form shows beside its title: its subject, then its term.
   *
   * @param {?Object} form The form.
   * @return {!Array<{key: string, value: string, variant: string}>} The
   *     labels it has.
   */
  function subjectDisplay(form) {
    var metadata = subjectTerm(form);
    var out = [];
    if (metadata.subject) {
      out.push({ key: 'subject', value: metadata.subject, variant: 'subject' });
    }
    if (metadata.term) {
      out.push({ key: 'term', value: metadata.term, variant: 'term' });
    }
    return out;
  }

  /**
   * Gives the term of a form, its caption and the name of its sheet.
   *
   * @param {?Object} form The form.
   * @return {string} The term.
   */
  function termOf(form) {
    return subjectTerm(form).term;
  }

  /** The metadata of a form with a term and a subject code. */
  var subjectAdapter = {
    editor: 'term-subject',
    duplicateAction: 'Duplicate for a new term',
    fields: ['term', 'subject'],
    legacyFields: [],
    defaults: subjectDefaults,
    read: subjectTerm,
    create: subjectCreate,
    duplicate: subjectDuplicate,
    update: subjectUpdate,
    applyUpdate: subjectUpdate,
    public: subjectTerm,
    display: subjectDisplay,
    caption: termOf,
    slug: termOf,
    sheet: termOf
  };

  var api = subjectAdapter;
  if (node) module.exports = api;
  root.FormMetadataSubject = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
