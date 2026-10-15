/** The Lists tab: the values of each list and what kind of list it is. */

/*
 * A row of the Lists tab is one list: its key and its choices as JSON. The row with the key
 * `_info` holds the name and the kind of each list an admin made, so the tab keeps its two
 * columns. A key that starts with "_" is never a list.
 */
var LIST_INFO_KEY_ = '_info';

var LIST_KINDS_ = ['sections', 'numbers', 'named', 'plain'];

/** The kind of each built-in list; a list an admin made has its kind in `_info`. */
var BUILTIN_LIST_KINDS_ = {
  levels: 'named',
  curricula: 'plain',
  majors: 'named',
  sections: 'sections',
  groups: 'plain',
  wa_sections: 'numbers'
};

var BUILTIN_LIST_NAMES_ = {
  levels: 'Levels',
  curricula: 'Bylaws',
  majors: 'Majors',
  sections: 'Sections',
  groups: 'Groups',
  wa_sections: 'WhatsApp section numbers'
};

function listRows_() {
  var sh = RegistryRepository.registry().getSheetByName(Constants.TABS.lists);
  return sh ? Table.readTable(sh, ['key', 'values']) : [];
}

function readLists() {
  var out = {};
  listRows_().forEach(function (r) {
    if (String(r.key).charAt(0) !== '_') out[r.key] = Json.parseJson(r.values, []);
  });
  return out;
}

/** { key: { name, kind } } for the lists an admin made. */
function readListInfo() {
  var row = listRows_().filter(function (r) {
    return r.key === LIST_INFO_KEY_;
  })[0];
  return row ? Json.parseJson(row.values, {}) : {};
}

function listKind_(key, info) {
  return (
    (info && info[key] && info[key].kind) || BUILTIN_LIST_KINDS_[key] || 'plain'
  );
}

function writeListRow_(key, json) {
  var sh = RegistryRepository.registry().getSheetByName(Constants.TABS.lists);
  var rows = Table.readTable(sh, ['key', 'values']);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === key) {
      Table.writeRow(sh, rows[i]._row, ['key', 'values'], { key: key, values: json });
      return;
    }
  }
  Table.appendPlain(sh, [key, json]);
}

function saveList(key, values) {
  writeListRow_(key, JSON.stringify(normalizeListValues(values)));
}

function saveListInfo_(info) {
  writeListRow_(LIST_INFO_KEY_, JSON.stringify(info));
}

function deleteList_(key) {
  var sh = RegistryRepository.registry().getSheetByName(Constants.TABS.lists);
  var row = Table.readTable(sh, ['key', 'values']).filter(function (r) {
    return r.key === key;
  })[0];
  if (row) sh.deleteRow(row._row);
  var info = readListInfo();
  delete info[key];
  saveListInfo_(info);
}

/** Forms whose questions, or member questions, read the list. */
function formsUsingList_(key) {
  var uses = function (fields) {
    return (fields || []).some(function (f) {
      return f.list === key || uses(f.fields);
    });
  };
  return readForms().filter(function (f) {
    return uses(f.fields);
  });
}
