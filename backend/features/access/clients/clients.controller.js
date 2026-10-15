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
  return { clients: ClientsRepository.readClients().map(ClientsService.publicClient) };
}

/**
 * Answers the `admin.clients.create` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function create(req) {
  var name = String(req.name || '').trim();
  if (!name) ApiError.fail('name_required', 'Give this person or group a name.');
  var token = ClientsService.newToken();
  var c = {
    id: Crypto.shortId('c_'),
    name: name,
    tokenHash: ClientsService.clientToken(token),
    forms: ClientsService.cleanClientForms(req.forms),
    hiddenColumns: Array.isArray(req.hiddenColumns) ? req.hiddenColumns : [],
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
  return { client: ClientsService.publicClient(c), token: token, accessKey: key };
}

/**
 * Answers the `admin.clients.update` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function update(req) {
  var p = req.patch || {};
  return ClientsRepository.changeClient(req.id, function (c) {
    if (p.name !== undefined) c.name = String(p.name).trim() || c.name;
    if (p.forms !== undefined) c.forms = ClientsService.cleanClientForms(p.forms);
    if (p.hiddenColumns !== undefined)
      c.hiddenColumns = Array.isArray(p.hiddenColumns) ? p.hiddenColumns : [];
    if (p.canReview !== undefined) c.canReview = !!p.canReview;
    if (p.showSizeAlerts !== undefined) c.showSizeAlerts = !!p.showSizeAlerts;
    if (p.active !== undefined) c.active = !!p.active;
    if (p.expires !== undefined) c.expires = ClientsService.cleanExpiry(p.expires);
    return { client: ClientsService.publicClient(c) };
  });
}

/**
 * Answers the `admin.clients.regenerate` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function regenerate(req) {
  var token = ClientsService.newToken();
  return ClientsRepository.changeClient(req.id, function (c) {
    c.tokenHash = ClientsService.clientToken(token);
    c.active = true;
    return { client: ClientsService.publicClient(c), token: token };
  });
}

/**
 * Gives a link a new access key (`on`), or removes its key so the link alone opens it.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function setKey(req) {
  var key = req.on === false ? '' : ClientsService.newClientKey();
  return ClientsRepository.changeClient(req.id, function (c) {
    ClientsService.setClientKey(c, key);
    CacheService.getScriptCache().remove('client_key:' + c.id);
    return { client: ClientsService.publicClient(c), accessKey: key };
  });
}

/**
 * The admin reads a link's current key, for example when the client lost it.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function showKey(req) {
  var c = ClientsRepository.readClients().filter(function (x) {
    return x.id === req.id;
  })[0];
  if (!c) ApiError.fail('client_not_found', 'That client does not exist.');
  if (!c.keyHash) ApiError.fail('no_key', 'This link does not ask for a key.');
  var key = Crypto.unsealDigits(ClientsService.clientKeyPad(c), c.keySeal, 6);
  if (!key || ClientsService.clientKeyHash(c, key) !== c.keyHash)
    ApiError.fail(
      'key_unknown',
      'This key was made before keys could be shown. Make a new key to see it.'
    );
  return { accessKey: key };
}

/**
 * Answers the `admin.clients.remove` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function remove(req) {
  return Lock.withLock(function () {
    var c = ClientsRepository.readClients().filter(function (x) {
      return x.id === req.id;
    })[0];
    if (!c) ApiError.fail('client_not_found', 'That client does not exist.');
    ClientsRepository.clientsSheet().deleteRow(c._row);
    return { removed: true };
  });
}

return { list, create, update, regenerate, setKey, showKey, remove };
})();
