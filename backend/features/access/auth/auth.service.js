/**
 * Admin access. The PIN is stored only as a salted hash and every wrong
 * guess counts toward a temporary lock, so the PIN cannot be brute forced.
 */

var AuthService = (function () {
  var ADMIN_MAX_FAILS = 8;

  var ADMIN_LOCK_SECONDS = 600;

  function pinHash_(pin) {
    return Crypto.sha256Hex(Properties.pepper() + ':admin:' + pin);
  }

  /** Called from the menu: stores a new admin PIN. */
  function setAdminPin(pin) {
    pin = String(pin || '').trim();
    if (pin.length < 4)
      ApiError.fail('weak_pin', 'The admin PIN needs at least 4 characters.');
    Properties.setProp(Constants.PROPS.ADMIN_PIN_HASH, pinHash_(pin));
    return true;
  }

  /** Called from the menu: forgets the wrong tries, which lifts a lock. Returns true when the page was locked. */
  function unlockAdmin() {
    var cache = CacheService.getScriptCache();
    var locked =
      parseInt(cache.get(Constants.CACHE.ADMIN_FAILS) || '0', 10) >=
      ADMIN_MAX_FAILS;
    cache.remove(Constants.CACHE.ADMIN_FAILS);
    return locked;
  }

  function requireAdmin(req) {
    var stored = Properties.getProp(Constants.PROPS.ADMIN_PIN_HASH);
    if (!stored)
      ApiError.fail(
        'not_configured',
        'Set the admin PIN from the Forms Platform menu first.'
      );
    var cache = CacheService.getScriptCache();
    var fails = parseInt(cache.get(Constants.CACHE.ADMIN_FAILS) || '0', 10);
    if (fails >= ADMIN_MAX_FAILS)
      ApiError.fail(
        'locked',
        'Too many wrong PINs. Wait ten minutes, or unlock the admin page from the Forms Platform menu in the sheet.'
      );
    var pin = req && req.admin && req.admin.pin;
    if (!pin || pinHash_(pin) !== stored) {
      cache.put(
        Constants.CACHE.ADMIN_FAILS,
        String(fails + 1),
        ADMIN_LOCK_SECONDS
      );
      ApiError.fail('bad_pin', 'That PIN is not correct.');
    }
    cache.remove(Constants.CACHE.ADMIN_FAILS);
    return true;
  }

  return { requireAdmin, setAdminPin, unlockAdmin, pinHash: pinHash_ };
})();
