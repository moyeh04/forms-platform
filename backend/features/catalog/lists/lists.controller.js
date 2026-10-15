/** The list actions of the admin: read, fill, make, rename and delete lists. */

var ListsController = (function () {
function listsOut_() {
  return { lists: ListsRepository.readLists(), info: ListsRepository.readListInfo() };
}

function requireList_(key) {
  key = String(key || '');
  if (!key || key.charAt(0) === '_' || !ListsRepository.readLists().hasOwnProperty(key))
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
        ListsRepository.BUILTIN_LIST_NAMES[k] ||
        ''
      ).toLowerCase() === name.toLowerCase()
    );
  });
  if (taken) ApiError.fail('list_name_taken', 'Another list has that name.');
  return name;
}

/** A handler that changes the Lists tab: it reads and writes inside the lock, then returns every list. */
function listChange_(change) {
  return function (req) {
    return Lock.withLock(function () {
      var extra = change(req) || {};
      return Object.assign(listsOut_(), extra);
    });
  };
}

/**
 * Answers the `admin.lists.get` action.
 *
 * @return {*} The answer, sent back as JSON.
 */
function get() {
  return listsOut_();
}

/**
 * Answers the `admin.lists.set` action.
 *
 * @param {!Object} req The request body.
 */
function set(req) {
  ListsRepository.saveList(requireList_(req.key), req.values || []);
}

/**
 * A new list: a name, a kind, and the choices to start with (empty, or a copy of another list).
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function create(req) {
  var lists = ListsRepository.readLists();
  var info = ListsRepository.readListInfo();
  var name = freeListName_(req.name, lists, info);
  var kind = ListsRepository.LIST_KINDS.indexOf(req.kind) === -1 ? 'plain' : req.kind;
  var base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'list';
  var key = base,
    n = 2;
  while (lists.hasOwnProperty(key) || ListsRepository.BUILTIN_LIST_KINDS.hasOwnProperty(key))
    key = base + '_' + n++;
  ListsRepository.saveList(key, req.copyOf ? lists[requireList_(req.copyOf)] : []);
  info[key] = { name: name, kind: kind };
  ListsRepository.saveListInfo(info);
  return { key: key };
}

/**
 * Answers the `admin.lists.rename` action.
 *
 * @param {!Object} req The request body.
 */
function rename(req) {
  var key = requireList_(req.key);
  var info = ListsRepository.readListInfo();
  if (!info[key])
    ApiError.fail(
      'list_builtin',
      'The lists that came with the platform keep their names.'
    );
  info[key].name = freeListName_(req.name, ListsRepository.readLists(), info, key);
  ListsRepository.saveListInfo(info);
}

/**
 * Only a list an admin made, and only while no form asks it.
 *
 * @param {!Object} req The request body.
 */
function remove(req) {
  var key = requireList_(req.key);
  if (!ListsRepository.readListInfo()[key])
    ApiError.fail(
      'list_builtin',
      'The lists that came with the platform cannot be deleted.'
    );
  var users = ListsRepository.formsUsingList(key);
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
  ListsRepository.deleteList(key);
}

return {
  get,
  set: listChange_(set),
  create: listChange_(create),
  rename: listChange_(rename),
  remove: listChange_(remove)
};
})();
