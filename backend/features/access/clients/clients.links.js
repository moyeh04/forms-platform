/**
 * The admin's work on private links: list, make, change, renew, key, show
 * and remove them.
 */

var ClientsLinks = (function () {
  /**
   * Lists every link as the admin sees it.
   *
   * @return {!Array<!Object>} The links.
   */
  function listLinks_() {
    return ClientsRepository.readClients().map(ClientsService.publicClient);
  }

  /**
   * Reads the hidden columns the admin chose.
   *
   * @param {*} value The columns as sent.
   * @return {!Array<string>} The columns, or none.
   */
  function hiddenColumnsOf_(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * Makes a new link.
   *
   * @param {!Object} req The request body: name, forms, hidden columns,
   *     review and size alert switches, end date and whether to add a key.
   * @return {{client: !Object, token: string, accessKey: string}} The link,
   *     its token and its key, which are shown only now.
   * @throws {ApiError} `name_required` when it has no name.
   */
  function createLink_(req) {
    var name = String(req.name || '').trim();
    if (!name)
      ApiError.fail('name_required', 'Give this person or group a name.');
    var token = ClientsService.newToken();
    var c = {
      id: Crypto.shortId('c_'),
      name: name,
      tokenHash: ClientsService.clientToken(token),
      forms: ClientsService.cleanClientForms(req.forms),
      hiddenColumns: hiddenColumnsOf_(req.hiddenColumns),
      canReview: !!req.canReview,
      showSizeAlerts: req.showSizeAlerts !== false,
      active: true,
      createdAt: Time.nowIso(),
      expires: ClientsService.cleanExpiry(req.expires)
    };
    var key = req.withKey === false ? '' : ClientsService.newClientKey();
    ClientsService.setClientKey(c, key);
    Lock.withLock(function () {
      ClientsRepository.saveClient(c);
    });
    return {
      client: ClientsService.publicClient(c),
      token: token,
      accessKey: key
    };
  }

  /**
   * Applies the fields of a change that are given.
   *
   * @param {!Object} c The link, changed in place.
   * @param {!Object} p The change.
   */
  function applyPatch_(c, p) {
    var flags = ['canReview', 'showSizeAlerts', 'active'];
    if (p.name !== undefined) c.name = String(p.name).trim() || c.name;
    if (p.forms !== undefined)
      c.forms = ClientsService.cleanClientForms(p.forms);
    if (p.hiddenColumns !== undefined)
      c.hiddenColumns = hiddenColumnsOf_(p.hiddenColumns);
    flags.forEach(function (k) {
      if (p[k] !== undefined) c[k] = !!p[k];
    });
    if (p.expires !== undefined)
      c.expires = ClientsService.cleanExpiry(p.expires);
  }

  /**
   * Changes a link.
   *
   * @param {string} id The id of the link.
   * @param {!Object} patch The fields to change.
   * @return {{client: !Object}} The changed link.
   */
  function updateLink_(id, patch) {
    return ClientsRepository.changeClient(id, function (c) {
      applyPatch_(c, patch);
      return { client: ClientsService.publicClient(c) };
    });
  }

  /**
   * Gives a link a new token and turns it on; the old link opens nothing.
   *
   * @param {string} id The id of the link.
   * @return {{client: !Object, token: string}} The link and its new token.
   */
  function renewLink_(id) {
    var token = ClientsService.newToken();
    return ClientsRepository.changeClient(id, function (c) {
      c.tokenHash = ClientsService.clientToken(token);
      c.active = true;
      return { client: ClientsService.publicClient(c), token: token };
    });
  }

  /**
   * Gives a link a new access key, or removes its key so the link alone
   * opens it. The count of wrong keys starts again.
   *
   * @param {string} id The id of the link.
   * @param {boolean} on False to remove the key.
   * @return {{client: !Object, accessKey: string}} The link and its key.
   */
  function setLinkKey_(id, on) {
    var key = on ? ClientsService.newClientKey() : '';
    return ClientsRepository.changeClient(id, function (c) {
      ClientsService.setClientKey(c, key);
      CacheService.getScriptCache().remove(
        Constants.CACHE.CLIENT_KEY_PREFIX + c.id
      );
      return { client: ClientsService.publicClient(c), accessKey: key };
    });
  }

  /**
   * Finds a link by id.
   *
   * @param {string} id The id.
   * @return {!Object} The link.
   * @throws {ApiError} `client_not_found` when there is none.
   */
  function requireLink_(id) {
    var c = ClientsRepository.readClients().filter(function (x) {
      return x.id === id;
    })[0];
    if (!c) ApiError.fail('client_not_found', 'That client does not exist.');
    return c;
  }

  /**
   * Opens the current access key of a link, for example when the client
   * lost it.
   *
   * @param {string} id The id of the link.
   * @return {string} The key.
   * @throws {ApiError} `no_key` for a link with no key, `key_unknown` for a
   *     key made before keys were sealed.
   */
  function shownKey_(id) {
    var c = requireLink_(id);
    if (!c.keyHash)
      ApiError.fail('no_key', 'This link does not ask for a key.');
    var key = Crypto.unsealDigits(
      ClientsService.clientKeyPad(c),
      c.keySeal,
      ClientsService.KEY_DIGITS
    );
    if (!key || ClientsService.clientKeyHash(c, key) !== c.keyHash)
      ApiError.fail(
        'key_unknown',
        'This key was made before keys could be shown. ' +
          'Make a new key to see it.'
      );
    return key;
  }

  /**
   * Deletes a link.
   *
   * @param {string} id The id of the link.
   * @throws {ApiError} `client_not_found` when there is none.
   */
  function removeLink_(id) {
    Lock.withLock(function () {
      ClientsRepository.deleteClient(requireLink_(id));
    });
  }

  return {
    listLinks: listLinks_,
    createLink: createLink_,
    updateLink: updateLink_,
    renewLink: renewLink_,
    setLinkKey: setLinkKey_,
    shownKey: shownKey_,
    removeLink: removeLink_
  };
})();
