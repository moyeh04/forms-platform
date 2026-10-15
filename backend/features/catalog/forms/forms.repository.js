/** The Forms tab: reading, finding and saving form rows. */

var FormsRepository = (function () {
  /** The columns of the Forms tab, in order. */
  var FORM_COLS = [
    'id',
    'slug',
    'type',
    'title',
    'term',
    'status',
    'opensAt',
    'closesAt',
    'sheetId',
    'sheetUrl',
    'config',
    'createdAt',
    'updatedAt'
  ];

  /** The columns kept as they are; every other setting goes in `config`. */
  var FORM_BASE_ = [
    'id',
    'slug',
    'type',
    'title',
    'term',
    'status',
    'opensAt',
    'closesAt',
    'sheetId',
    'sheetUrl',
    'createdAt',
    'updatedAt'
  ];

  /** The first row of data, under the header. */
  var FIRST_ROW_ = 2;

  /**
   * Opens the Forms tab of the registry.
   *
   * @return {!SpreadsheetApp.Sheet} The tab.
   */
  function formsSheet() {
    return RegistryRepository.registry().getSheetByName(Constants.TABS.forms);
  }

  /**
   * Makes a form from its row.
   *
   * @param {!Object} row The row by column.
   * @return {!Object} The form.
   */
  function rowToForm_(row) {
    var form = Json.parseJson(row.config, {});
    FORM_BASE_.forEach(function (k) {
      form[k] = row[k] === undefined ? '' : String(row[k]);
    });
    Object.assign(form, FormMetadata.read(form));
    TemplateFields.normalizeReservationMembers(form);
    return form;
  }

  /**
   * Makes the row of a form.
   *
   * @param {!Object} form The form.
   * @return {!Object} The row by column, with the rest in `config`.
   */
  function formToRow_(form) {
    var config = Json.clone(form);
    FORM_BASE_.forEach(function (k) {
      delete config[k];
    });
    var row = {};
    FORM_BASE_.forEach(function (k) {
      row[k] = form[k];
    });
    row.config = JSON.stringify(config);
    return row;
  }

  /**
   * Reads every form.
   *
   * @return {!Array<!Object>} The forms.
   */
  function readForms() {
    return Table.readTable(formsSheet(), FORM_COLS).map(rowToForm_);
  }

  /**
   * Finds a form by its slug or id.
   *
   * @param {*} slugOrId The slug or id.
   * @return {?Object} The form, or null.
   */
  function findForm(slugOrId) {
    var hit = readForms().filter(function (f) {
      return f.slug === slugOrId || f.id === slugOrId;
    })[0];
    return hit || null;
  }

  /**
   * Reads a form by its slug or id.
   *
   * @param {*} slugOrId The slug or id.
   * @return {!Object} The form.
   * @throws {ApiError} `form_not_found` when there is no such form.
   */
  function requireForm(slugOrId) {
    var f = findForm(slugOrId);
    if (!f) ApiError.fail('form_not_found', 'That form does not exist.');
    return f;
  }

  /**
   * Finds the row a form is on now. Rows move up when a form above is
   * deleted, so it is looked up for each write.
   *
   * @param {!SpreadsheetApp.Sheet} sh The Forms tab.
   * @param {string} id The id of the form.
   * @return {number} The row, or 0 when the form has none.
   */
  function formRow_(sh, id) {
    var last = sh.getLastRow();
    if (last < FIRST_ROW_) return 0;
    var ids = sh.getRange(FIRST_ROW_, 1, last - 1, 1).getValues();
    var at = ids
      .map(function (r) {
        return String(r[0]);
      })
      .indexOf(id);
    return at === -1 ? 0 : at + FIRST_ROW_;
  }

  /**
   * Writes a form to its row, or to a new row when it has none. Call it
   * inside Lock.withLock.
   *
   * @param {!Object} form The form; its `updatedAt` is stamped.
   * @return {!Object} The form.
   */
  function saveForm(form) {
    form.updatedAt = Time.nowIso();
    var sh = formsSheet();
    var at = formRow_(sh, form.id);
    if (at) Table.writeRow(sh, at, FORM_COLS, formToRow_(form));
    else Table.appendPlain(sh, Table.rowValues(FORM_COLS, formToRow_(form)));
    return form;
  }

  /**
   * Deletes the row of a form. Call it inside Lock.withLock.
   *
   * @param {string} id The id of the form.
   */
  function deleteForm(id) {
    var sh = formsSheet();
    sh.deleteRow(formRow_(sh, id));
  }

  return {
    FORM_COLS,
    readForms,
    findForm,
    requireForm,
    saveForm,
    deleteForm
  };
})();
