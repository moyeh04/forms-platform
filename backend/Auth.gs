/**
 * Admin access. The PIN is stored only as a salted hash and every wrong
 * guess counts toward a temporary lock, so the PIN cannot be brute forced.
 */

var API = API || {};

var ADMIN_MAX_FAILS = 8;
var ADMIN_LOCK_SECONDS = 600;

function pinHash_(pin) {
  return sha256Hex(pepper() + ':admin:' + pin);
}

/** Called from the menu: stores a new admin PIN. */
function setAdminPin(pin) {
  pin = String(pin || '').trim();
  if (pin.length < 4) fail('weak_pin', 'The admin PIN needs at least 4 characters.');
  setProp('ADMIN_PIN_HASH', pinHash_(pin));
  return true;
}

function requireAdmin(req) {
  var stored = getProp('ADMIN_PIN_HASH');
  if (!stored) fail('not_configured', 'Set the admin PIN from the Forms Platform menu first.');
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('admin_fails') || '0', 10);
  if (fails >= ADMIN_MAX_FAILS) fail('locked', 'Too many wrong PINs. Wait a few minutes and try again.');
  var pin = req && req.admin && req.admin.pin;
  if (!pin || pinHash_(pin) !== stored) {
    cache.put('admin_fails', String(fails + 1), ADMIN_LOCK_SECONDS);
    fail('bad_pin', 'That PIN is not correct.');
  }
  cache.remove('admin_fails');
  return true;
}

/** Wraps a handler so it only runs for a verified admin. */
function admin(fn) {
  return function (req) {
    requireAdmin(req);
    return fn(req);
  };
}

API['admin.login'] = admin(function () {
  return { admin: true };
});
