/** The Lists tab: the values of each list and what kind of list it is. */

var ListsRepository = (function () {
  /*
   * A row of the Lists tab is one list: its key and its choices as JSON. The
   * row with the key `_info` holds the name and the kind of each list an
   * admin made, so the tab keeps its two columns. A key that starts with "_"
   * is never a list.
   */
  var LIST_INFO_KEY_ = '_info';

  /**
   * The kind of each built-in list; a list an admin made has its kind in
   * `_info`.
   */
  var BUILTIN_LIST_KINDS_ = {
    levels: ListKind.NAMED,
    curricula: ListKind.PLAIN,
    majors: ListKind.NAMED,
    sections: ListKind.SECTIONS,
    groups: ListKind.PLAIN,
    wa_sections: ListKind.NUMBERS
  };

  /** The name each built-in list is shown with. */
  var BUILTIN_LIST_NAMES_ = {
    levels: 'Levels',
    curricula: 'Bylaws',
    majors: 'Majors',
    sections: 'Sections',
    groups: 'Groups',
    wa_sections: 'WhatsApp section numbers'
  };

  /** The columns of the Lists tab. */
  var COLS_ = ['key', 'values'];

  /**
   * Opens the Lists tab of the registry.
   *
   * @return {?SpreadsheetApp.Sheet} The tab, or null when it is missing.
   */
  function listsSheet_() {
    return RegistryRepository.registry().getSheetByName(Constants.TABS.lists);
  }

  /**
   * Reads the rows of the Lists tab.
   *
   * @return {!Array<!Object>} The rows, or none when the tab is missing.
   */
  function listRows_() {
    var sh = listsSheet_();
    return sh ? Table.readTable(sh, COLS_) : [];
  }

  /**
   * Reads every list.
   *
   * @return {!Object<string, !Array<*>>} The choices of each list by key.
   */
  function readLists() {
    var out = {};
    listRows_().forEach(function (r) {
      if (String(r.key).charAt(0) !== '_')
        out[r.key] = Json.parseJson(r.values, []);
    });
    return out;
  }

  /**
   * Reads the name and kind of each list an admin made.
   *
   * @return {!Object<string, {name: string, kind: string}>} The info by key.
   */
  function readListInfo() {
    var row = listRows_().filter(function (r) {
      return r.key === LIST_INFO_KEY_;
    })[0];
    return row ? Json.parseJson(row.values, {}) : {};
  }

  /**
   * Gives the kind of a list.
   *
   * @param {string} key The key of the list.
   * @param {?Object} info The info of the lists an admin made.
   * @return {string} The kind; `plain` when nothing names one.
   */
  function listKind_(key, info) {
    return info?.[key]?.kind || BUILTIN_LIST_KINDS_[key] || 'plain';
  }

  /**
   * Writes the row of a key, adding it when the tab has none.
   *
   * @param {string} key The key.
   * @param {string} json The value, as JSON.
   */
  function writeListRow_(key, json) {
    var sh = listsSheet_();
    var row = Table.readTable(sh, COLS_).filter(function (r) {
      return r.key === key;
    })[0];
    if (row) Table.writeRow(sh, row._row, COLS_, { key: key, values: json });
    else Table.appendPlain(sh, [key, json]);
  }

  /**
   * Saves the choices of a list, cleaned.
   *
   * @param {string} key The key of the list.
   * @param {!Array<*>} values The choices.
   */
  function saveList(key, values) {
    writeListRow_(key, JSON.stringify(ListsRules.normalizeListValues(values)));
  }

  /**
   * Saves the name and kind of each list an admin made.
   *
   * @param {!Object} info The info by key.
   */
  function saveListInfo_(info) {
    writeListRow_(LIST_INFO_KEY_, JSON.stringify(info));
  }

  /**
   * Deletes a list and its info.
   *
   * @param {string} key The key of the list.
   */
  function deleteList_(key) {
    var sh = listsSheet_();
    var row = Table.readTable(sh, COLS_).filter(function (r) {
      return r.key === key;
    })[0];
    if (row) sh.deleteRow(row._row);
    var info = readListInfo();
    delete info[key];
    saveListInfo_(info);
  }

  /**
   * Says whether some fields, or the fields inside them, read a list.
   *
   * @param {?Array<!Object>} fields The fields.
   * @param {string} key The key of the list.
   * @return {boolean} True when one of them reads it.
   */
  function fieldsUse_(fields, key) {
    return (fields || []).some(function (f) {
      return f.list === key || fieldsUse_(f.fields, key);
    });
  }

  /**
   * Lists the forms whose questions, or member questions, read a list.
   *
   * @param {string} key The key of the list.
   * @return {!Array<!Object>} The forms.
   */
  function formsUsingList_(key) {
    return FormsRepository.readForms().filter(function (f) {
      return fieldsUse_(f.fields, key);
    });
  }

  return {
    readLists,
    readListInfo,
    listKind: listKind_,
    BUILTIN_LIST_NAMES: BUILTIN_LIST_NAMES_,
    saveList,
    BUILTIN_LIST_KINDS: BUILTIN_LIST_KINDS_,
    saveListInfo: saveListInfo_,
    formsUsingList: formsUsingList_,
    deleteList: deleteList_
  };
})();
