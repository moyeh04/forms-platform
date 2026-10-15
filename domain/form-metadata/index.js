/**
 * What each form type shows beside its title, and how it is read, saved and
 * copied: a term and a subject code for most forms, a batch year for a
 * WhatsApp registration. The pages, the Node tests and the Apps Script
 * backend all load it, as the global FormMetadata, after its parts.
 */
(function (root) {
  'use strict';

  var node = typeof module === 'object' && module.exports;
  var reading = node ? require('./read.js') : root.FormMetadataRead;
  var subjectAdapter = node
    ? require('./subject.js')
    : root.FormMetadataSubject;
  var batchAdapter = node ? require('./batch.js') : root.FormMetadataBatch;
  var own = reading.own;
  var fieldOf = reading.fieldOf;

  /** The metadata of each form type. */
  var TYPES = {
    team_registration: subjectAdapter,
    task_submission: subjectAdapter,
    reservation: subjectAdapter,
    whatsapp_registration: batchAdapter
  };

  /**
   * Gives the metadata of a form type; a type it does not know has a term
   * and a subject.
   *
   * @param {*} type The form type.
   * @return {!Object} The metadata.
   */
  function forType(type) {
    return own(TYPES, type) ? TYPES[type] : subjectAdapter;
  }

  /**
   * Gives the metadata of a form's type.
   *
   * @param {?Object} form The form.
   * @return {!Object} The metadata.
   */
  function forForm(form) {
    return forType(fieldOf(form, 'type'));
  }

  /**
   * Gives the metadata fields of a new form.
   *
   * @param {*} type The form type.
   * @param {?Object=} values What the admin typed.
   * @return {!Object} The cleaned fields.
   */
  function create(type, values) {
    return forType(type).create(values || {});
  }

  /**
   * Gives the metadata fields of a copy of a form.
   *
   * @param {?Object} form The form copied.
   * @param {?Object=} values What the admin typed.
   * @return {!Object} The fields of the copy.
   */
  function duplicate(form, values) {
    return forForm(form).duplicate(form || {}, values || {});
  }

  /**
   * Gives the metadata a new form of a type starts with.
   *
   * @param {*} type The form type.
   * @return {!Object} The fields.
   */
  function defaults(type) {
    return forType(type).defaults();
  }

  /**
   * Lists the metadata fields of a form type.
   *
   * @param {*} type The form type.
   * @return {!Array<string>} The fields.
   */
  function fields(type) {
    return forType(type).fields.slice();
  }

  /**
   * Lists the fields an older form of a type kept its metadata in.
   *
   * @param {*} type The form type.
   * @return {!Array<string>} The fields.
   */
  function legacyFields(type) {
    return forType(type).legacyFields.slice();
  }

  /**
   * Reads the metadata of a form.
   *
   * @param {?Object} form The form.
   * @return {!Object} The fields.
   */
  function read(form) {
    return forForm(form).read(form || {});
  }

  /**
   * Writes the metadata a form reads onto it, for an older form.
   *
   * @param {!Object} form The form; it changes.
   * @return {!Object} The same form.
   */
  function hydrate(form) {
    Object.assign(form, read(form));
    return form;
  }

  /**
   * Saves changed metadata on a form.
   *
   * @param {!Object} form The form; it changes.
   * @param {?Object=} patch The changes.
   */
  function update(form, patch) {
    forForm(form).update(form, patch || {});
  }

  /**
   * Gives the metadata a student sees.
   *
   * @param {?Object} form The form.
   * @return {!Object} The fields.
   */
  function publicOf(form) {
    return forForm(form).public(form || {});
  }

  /**
   * Lists what a form shows beside its title.
   *
   * @param {?Object} form The form.
   * @return {!Array<!Object>} The labels.
   */
  function display(form) {
    return forForm(form).display(form || {});
  }

  /**
   * Gives the caption of a form.
   *
   * @param {?Object} form The form.
   * @return {string} The caption.
   */
  function caption(form) {
    return forForm(form).caption(form || {});
  }

  /**
   * Gives the part of a form's link name its metadata adds.
   *
   * @param {?Object} form The form.
   * @return {string} The part.
   */
  function slug(form) {
    return forForm(form).slug(form || {});
  }

  /**
   * Gives the part of a form's sheet name its metadata adds.
   *
   * @param {?Object} form The form.
   * @return {string} The part.
   */
  function sheet(form) {
    return forForm(form).sheet(form || {});
  }

  var api = {
    forType: forType,
    create: create,
    duplicate: duplicate,
    defaults: defaults,
    fields: fields,
    academicYears: reading.academicYears,
    termParts: reading.termParts,
    legacyFields: legacyFields,
    read: read,
    hydrate: hydrate,
    update: update,
    public: publicOf,
    display: display,
    caption: caption,
    slug: slug,
    sheet: sheet
  };
  if (node) module.exports = api;
  root.FormMetadata = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
