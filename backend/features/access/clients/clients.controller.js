/**
 * The link actions of the admin: list, make, change, renew, key, show and
 * remove.
 */

var API = API || {};

API['admin.clients.list'] = admin(function () {
  return { clients: readClients_().map(publicClient_) };
});

API['admin.clients.create'] = admin(function (req) {
  var name = String(req.name || '').trim();
  if (!name) ApiError.fail('name_required', 'Give this person or group a name.');
  var token = newToken_();
  var c = {
    id: shortId('c_'),
    name: name,
    tokenHash: clientToken_(token),
    forms: cleanClientForms_(req.forms),
    hiddenColumns: Array.isArray(req.hiddenColumns) ? req.hiddenColumns : [],
    canReview: !!req.canReview,
    showSizeAlerts: req.showSizeAlerts !== false,
    active: true,
    createdAt: nowIso(),
    expires: cleanExpiry_(req.expires)
  };
  var key = req.withKey === false ? '' : newClientKey_();
  setClientKey_(c, key);
  withLock_(function () {
    saveClient_(c);
  });
  return { client: publicClient_(c), token: token, accessKey: key };
});

API['admin.clients.update'] = admin(function (req) {
  var p = req.patch || {};
  return changeClient_(req.id, function (c) {
    if (p.name !== undefined) c.name = String(p.name).trim() || c.name;
    if (p.forms !== undefined) c.forms = cleanClientForms_(p.forms);
    if (p.hiddenColumns !== undefined)
      c.hiddenColumns = Array.isArray(p.hiddenColumns) ? p.hiddenColumns : [];
    if (p.canReview !== undefined) c.canReview = !!p.canReview;
    if (p.showSizeAlerts !== undefined) c.showSizeAlerts = !!p.showSizeAlerts;
    if (p.active !== undefined) c.active = !!p.active;
    if (p.expires !== undefined) c.expires = cleanExpiry_(p.expires);
    return { client: publicClient_(c) };
  });
});

API['admin.clients.regenerate'] = admin(function (req) {
  var token = newToken_();
  return changeClient_(req.id, function (c) {
    c.tokenHash = clientToken_(token);
    c.active = true;
    return { client: publicClient_(c), token: token };
  });
});

/** Gives a link a new access key (`on`), or removes its key so the link alone opens it. */
API['admin.clients.key'] = admin(function (req) {
  var key = req.on === false ? '' : newClientKey_();
  return changeClient_(req.id, function (c) {
    setClientKey_(c, key);
    CacheService.getScriptCache().remove('client_key:' + c.id);
    return { client: publicClient_(c), accessKey: key };
  });
});

/** The admin reads a link's current key, for example when the client lost it. */
API['admin.clients.showKey'] = admin(function (req) {
  var c = readClients_().filter(function (x) {
    return x.id === req.id;
  })[0];
  if (!c) ApiError.fail('client_not_found', 'That client does not exist.');
  if (!c.keyHash) ApiError.fail('no_key', 'This link does not ask for a key.');
  var key = unsealDigits_(clientKeyPad_(c), c.keySeal, 6);
  if (!key || clientKeyHash_(c, key) !== c.keyHash)
    ApiError.fail(
      'key_unknown',
      'This key was made before keys could be shown. Make a new key to see it.'
    );
  return { accessKey: key };
});

API['admin.clients.remove'] = admin(function (req) {
  return withLock_(function () {
    var c = readClients_().filter(function (x) {
      return x.id === req.id;
    })[0];
    if (!c) ApiError.fail('client_not_found', 'That client does not exist.');
    clientsSheet_().deleteRow(c._row);
    return { removed: true };
  });
});
