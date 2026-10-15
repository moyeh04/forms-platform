/** The list actions of the admin: read, fill, make, rename and delete lists. */

var API = API || {};

function listsOut_() {
  return { lists: readLists(), info: readListInfo() };
}

function requireList_(key) {
  key = String(key || '');
  if (!key || key.charAt(0) === '_' || !readLists().hasOwnProperty(key))
    ApiError.fail('list_not_found', 'There is no such list.');
  return key;
}

/** A list's name as the admin typed it, cut to length; refused when empty or when another list has it. */
function freeListName_(name, lists, info, self) {
  name = String(name || '')
    .trim()
    .slice(0, 60);
  if (!name) ApiError.fail('list_name', 'Give the list a name.');
  var taken = Object.keys(lists).some(function (k) {
    return (
      k !== self &&
      (
        (info[k] && info[k].name) ||
        BUILTIN_LIST_NAMES_[k] ||
        ''
      ).toLowerCase() === name.toLowerCase()
    );
  });
  if (taken) ApiError.fail('list_name_taken', 'Another list has that name.');
  return name;
}

/** A handler that changes the Lists tab: it reads and writes inside the lock, then returns every list. */
function listChange_(change) {
  return AuthService.admin(function (req) {
    return Lock.withLock(function () {
      var extra = change(req) || {};
      return Object.assign(listsOut_(), extra);
    });
  });
}

API['admin.lists.get'] = AuthService.admin(function () {
  return listsOut_();
});

API['admin.lists.set'] = listChange_(function (req) {
  saveList(requireList_(req.key), req.values || []);
});

/** A new list: a name, a kind, and the choices to start with (empty, or a copy of another list). */
API['admin.lists.create'] = listChange_(function (req) {
  var lists = readLists();
  var info = readListInfo();
  var name = freeListName_(req.name, lists, info);
  var kind = LIST_KINDS_.indexOf(req.kind) === -1 ? 'plain' : req.kind;
  var base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'list';
  var key = base,
    n = 2;
  while (lists.hasOwnProperty(key) || BUILTIN_LIST_KINDS_.hasOwnProperty(key))
    key = base + '_' + n++;
  saveList(key, req.copyOf ? lists[requireList_(req.copyOf)] : []);
  info[key] = { name: name, kind: kind };
  saveListInfo_(info);
  return { key: key };
});

API['admin.lists.rename'] = listChange_(function (req) {
  var key = requireList_(req.key);
  var info = readListInfo();
  if (!info[key])
    ApiError.fail(
      'list_builtin',
      'The lists that came with the platform keep their names.'
    );
  info[key].name = freeListName_(req.name, readLists(), info, key);
  saveListInfo_(info);
});

/** Only a list an admin made, and only while no form asks it. */
API['admin.lists.delete'] = listChange_(function (req) {
  var key = requireList_(req.key);
  if (!readListInfo()[key])
    ApiError.fail(
      'list_builtin',
      'The lists that came with the platform cannot be deleted.'
    );
  var users = formsUsingList_(key);
  if (users.length)
    ApiError.fail(
      'list_in_use',
      'A form still asks this list: ' +
        users
          .map(function (f) {
            return f.title;
          })
          .join(', ') +
        '.'
    );
  deleteList_(key);
});
