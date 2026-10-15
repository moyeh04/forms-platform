/** The list actions of the admin: read, fill, make, rename and delete lists. */

var ListsController = (function () {
  /**
   * Wraps an action that changes the Lists tab: it runs inside the lock,
   * then answers with every list.
   *
   * @param {function(!Object): ?Object} change The action; what it returns
   *     is added to the answer.
   * @return {function(!Object): !Object} The handler of the action.
   */
  function listChange_(change) {
    return function (req) {
      return Lock.withLock(function () {
        var extra = change(req) || {};
        return Object.assign(ListsService.listsView(), extra);
      });
    };
  }

  /**
   * Answers the `admin.lists.get` action.
   *
   * @return {*} The answer, sent back as JSON.
   */
  function get() {
    return ListsService.listsView();
  }

  /**
   * Answers the `admin.lists.set` action.
   *
   * @param {!Object} req The request body.
   */
  function set(req) {
    ListsService.setValues(req.key, req.values || []);
  }

  /**
   * Answers the `admin.lists.create` action: a new list with a name, a kind,
   * and the choices to start with (empty, or a copy of another list).
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function create(req) {
    return { key: ListsService.createList(req.name, req.kind, req.copyOf) };
  }

  /**
   * Answers the `admin.lists.rename` action.
   *
   * @param {!Object} req The request body.
   */
  function rename(req) {
    ListsService.renameList(req.key, req.name);
  }

  /**
   * Answers the `admin.lists.remove` action: only a list an admin made, and
   * only while no form asks it.
   *
   * @param {!Object} req The request body.
   */
  function remove(req) {
    ListsService.removeList(req.key);
  }

  return {
    get,
    set: listChange_(set),
    create: listChange_(create),
    rename: listChange_(rename),
    remove: listChange_(remove)
  };
})();
