/** The lists of the registry: read, fill, make, rename and delete them. */

var ListsService = (function () {
  /** The longest name a list may have. */
  var MAX_NAME_LENGTH_ = 60;

  /** The longest key made from a list name. */
  var MAX_KEY_LENGTH_ = 30;

  /** The first number added to a key another list has. */
  var FIRST_KEY_SUFFIX_ = 2;

  /**
   * Says whether an object has a key of its own.
   *
   * @param {!Object} object The object.
   * @param {string} key The key.
   * @return {boolean} True when the key is the object's own.
   */
  function hasKey_(object, key) {
    return Object.keys(object).indexOf(key) !== -1;
  }

  /**
   * Reads every list and the name and kind of each list an admin made.
   *
   * @return {{lists: !Object, info: !Object}} The lists and their info.
   */
  function listsView_() {
    return {
      lists: ListsRepository.readLists(),
      info: ListsRepository.readListInfo()
    };
  }

  /**
   * Checks that a key names a list.
   *
   * @param {*} key The key.
   * @return {string} The key.
   * @throws {ApiError} `list_not_found` when there is no such list.
   */
  function requireList_(key) {
    key = String(key || '');
    if (
      !key ||
      key.charAt(0) === '_' ||
      !hasKey_(ListsRepository.readLists(), key)
    )
      ApiError.fail('list_not_found', 'There is no such list.');
    return key;
  }

  /**
   * Gives the name a list is shown with.
   *
   * @param {string} key The key of the list.
   * @param {!Object} info The info of the lists an admin made.
   * @return {string} The name, or an empty string.
   */
  function shownName_(key, info) {
    return info[key]?.name || ListsRepository.BUILTIN_LIST_NAMES[key] || '';
  }

  /**
   * Cleans a list name as the admin typed it, cut to length.
   *
   * @param {*} name The typed name.
   * @param {!Object} lists Every list.
   * @param {!Object} info The info of the lists an admin made.
   * @param {string=} self The key of the list being renamed.
   * @return {string} The name.
   * @throws {ApiError} `list_name` when it is empty, `list_name_taken` when
   *     another list has it.
   */
  function freeListName_(name, lists, info, self) {
    name = String(name || '')
      .trim()
      .slice(0, MAX_NAME_LENGTH_);
    if (!name) ApiError.fail('list_name', 'Give the list a name.');
    var taken = Object.keys(lists).some(function (k) {
      return (
        k !== self && shownName_(k, info).toLowerCase() === name.toLowerCase()
      );
    });
    if (taken) ApiError.fail('list_name_taken', 'Another list has that name.');
    return name;
  }

  /**
   * Makes a key for a new list from its name, one no list has.
   *
   * @param {string} name The name of the list.
   * @param {!Object} lists Every list.
   * @return {string} The key.
   */
  function freeKey_(name, lists) {
    var base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, MAX_KEY_LENGTH_) || 'list';
    var key = base;
    var n = FIRST_KEY_SUFFIX_;
    while (
      hasKey_(lists, key) ||
      hasKey_(ListsRepository.BUILTIN_LIST_KINDS, key)
    )
      key = base + '_' + n++;
    return key;
  }

  /**
   * Replaces the choices of a list.
   *
   * @param {*} key The key of the list.
   * @param {!Array<*>} values The new choices.
   */
  function setValues_(key, values) {
    ListsRepository.saveList(requireList_(key), values);
  }

  /**
   * Makes a new list.
   *
   * @param {*} name Its name.
   * @param {*} kind Its kind; an unknown kind makes a plain list.
   * @param {*} copyOf The key of a list to copy the choices of, or nothing
   *     for an empty list.
   * @return {string} The key of the new list.
   */
  function createList_(name, kind, copyOf) {
    var lists = ListsRepository.readLists();
    var info = ListsRepository.readListInfo();
    var cleanName = freeListName_(name, lists, info);
    var key = freeKey_(cleanName, lists);
    ListsRepository.saveList(key, copyOf ? lists[requireList_(copyOf)] : []);
    info[key] = {
      name: cleanName,
      kind: Object.values(ListKind).indexOf(kind) === -1 ? ListKind.PLAIN : kind
    };
    ListsRepository.saveListInfo(info);
    return key;
  }

  /**
   * Renames a list an admin made.
   *
   * @param {*} key The key of the list.
   * @param {*} name The new name.
   * @throws {ApiError} `list_builtin` for a list that came with the platform.
   */
  function renameList_(key, name) {
    key = requireList_(key);
    var info = ListsRepository.readListInfo();
    if (!info[key])
      ApiError.fail(
        'list_builtin',
        'The lists that came with the platform keep their names.'
      );
    info[key].name = freeListName_(
      name,
      ListsRepository.readLists(),
      info,
      key
    );
    ListsRepository.saveListInfo(info);
  }

  /**
   * Deletes a list an admin made, while no form asks it.
   *
   * @param {*} key The key of the list.
   * @throws {ApiError} `list_builtin` for a list that came with the platform,
   *     `list_in_use` while a form asks it.
   */
  function removeList_(key) {
    key = requireList_(key);
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
    listsView: listsView_,
    setValues: setValues_,
    createList: createList_,
    renameList: renameList_,
    removeList: removeList_
  };
})();
