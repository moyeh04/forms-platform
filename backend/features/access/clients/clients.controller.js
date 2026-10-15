/**
 * The link actions of the admin: list, make, change, renew, key, show and
 * remove.
 */

var ClientsController = (function () {
  /**
   * Answers the `admin.clients.list` action.
   *
   * @return {*} The answer, sent back as JSON.
   */
  function list() {
    return { clients: ClientsLinks.listLinks() };
  }

  /**
   * Answers the `admin.clients.create` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function create(req) {
    return ClientsLinks.createLink(req);
  }

  /**
   * Answers the `admin.clients.update` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function update(req) {
    return ClientsLinks.updateLink(req.id, req.patch || {});
  }

  /**
   * Answers the `admin.clients.regenerate` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function regenerate(req) {
    return ClientsLinks.renewLink(req.id);
  }

  /**
   * Answers the `admin.clients.key` action: a new access key (`on`), or
   * no key so the link alone opens it.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function setKey(req) {
    return ClientsLinks.setLinkKey(req.id, req.on !== false);
  }

  /**
   * Answers the `admin.clients.showKey` action: the admin reads a link's
   * current key, for example when the client lost it.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function showKey(req) {
    return { accessKey: ClientsLinks.shownKey(req.id) };
  }

  /**
   * Answers the `admin.clients.remove` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function remove(req) {
    ClientsLinks.removeLink(req.id);
    return { removed: true };
  }

  return { list, create, update, regenerate, setKey, showKey, remove };
})();
