/**
 * Read-only access for instructors and clients through private links.
 * A link contains a random token; only its salted hash is stored, so a
 * leaked spreadsheet cannot be used to open anyone's view.
 *
 * A link can also need an access key: six digits the admin sends apart from the link, so a
 * link that is forwarded or leaked opens nothing on its own. Only the salted hash of the key
 * is stored, with a sealed copy only this script can open so the admin can look a lost key
 * up. Wrong keys lock the link for a while. A link made before keys existed has none and opens
 * as before.
 *
 * A link can end on a date (`expires`); after it, the link and its key open nothing until the
 * admin moves the date.
 *
 * A link shows the warnings about small teams of its forms unless the admin switches them off
 * for it (`showSizeAlerts`). Links made before the switch existed show them.
 *
 * A link names its forms by id, so renaming a form's link name does not take the form away
 * from it. Links saved with link names are read as ids and stored as ids on their next save.
 */

var ClientsService = (function () {
function clientToken_(token) {
  return Crypto.sha256Hex(Properties.pepper() + ':client:' + token);
}

function clientKeyHash_(c, key) {
  return Crypto.sha256Hex(Properties.pepper() + ':clientkey:' + c.id + ':' + key);
}

function clientKeyPad_(c) {
  return Crypto.sha256Hex(Properties.pepper() + ':clientseal:' + c.id);
}

/** Gives the link `key`, or no key when it is empty. */
function setClientKey_(c, key) {
  c.keyHash = key ? clientKeyHash_(c, key) : '';
  c.keySeal = key ? Crypto.sealDigits(clientKeyPad_(c), key) : '';
}

function clientExpired_(c) {
  return !!(c.expires && Date.parse(c.expires) < Date.now());
}

/** An end date from the admin: an ISO time, or empty for no end. */
function cleanExpiry_(value) {
  var v = String(value || '').trim();
  if (!v) return '';
  var t = Date.parse(v);
  if (isNaN(t)) ApiError.fail('bad_date', 'That end date is not a date.');
  return new Date(t).toISOString();
}

function newClientKey_() {
  var n = parseInt(Crypto.uuid().replace(/-/g, '').slice(0, 10), 16) % 1000000;
  return ('00000' + n).slice(-6);
}

function newToken_() {
  return (Crypto.uuid() + Crypto.uuid()).replace(/-/g, '').slice(0, 24);
}

function publicClient_(c) {
  return {
    id: c.id,
    name: c.name,
    forms: c.forms,
    hiddenColumns: c.hiddenColumns,
    canReview: c.canReview,
    showSizeAlerts: c.showSizeAlerts !== false,
    active: c.active,
    createdAt: c.createdAt,
    hasKey: !!c.keyHash,
    keyKnown: !!(c.keyHash && c.keySeal),
    expires: c.expires,
    expired: clientExpired_(c)
  };
}

function cleanClientForms_(list) {
  list = Array.isArray(list) ? list : [];
  if (list.indexOf('*') !== -1) return ['*'];
  return list.map(function (s) {
    var f = findForm(String(s));
    if (!f) ApiError.fail('form_not_found', 'Form "' + s + '" does not exist.');
    return f.id;
  });
}

return { clientToken: clientToken_, clientExpired: clientExpired_, clientKeyHash: clientKeyHash_, publicClient: publicClient_, newToken: newToken_, cleanClientForms: cleanClientForms_, cleanExpiry: cleanExpiry_, newClientKey: newClientKey_, setClientKey: setClientKey_, clientKeyPad: clientKeyPad_ };
})();
