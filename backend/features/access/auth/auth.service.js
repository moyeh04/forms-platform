/**
 * Admin access. The PIN is stored only as a salted hash and every wrong
 * guess counts toward a temporary lock, so the PIN cannot be brute forced.
 */

var AuthService = (function () {
  /** How many wrong PINs in a row lock the admin page. */
  var ADMIN_MAX_FAILS = 8;

  /** How long the wrong tries are remembered, and so the lock lasts. */
  var ADMIN_LOCK_SECONDS = 600;

  /** The shortest PIN the admin may set. */
  var MIN_PIN_LENGTH_ = 4;

  /**
   * Hashes a PIN with the secret pepper.
   *
   * @param {*} pin The PIN.
   * @return {string} The hash the script stores.
   */
  function pinHash_(pin) {
    return Crypto.sha256Hex(Properties.pepper() + ':admin:' + pin);
  }

  /**
   * Reads how many wrong PINs were entered in a row.
   *
   * @param {!CacheService.Cache} cache The script cache.
   * @return {number} The wrong tries remembered now.
   */
  function failCount_(cache) {
    return parseInt(cache.get(Constants.CACHE.ADMIN_FAILS) || '0', 10);
  }

  /**
   * Stores a new admin PIN. Called from the sheet menu.
   *
   * @param {*} pin The new PIN.
   * @return {boolean} True once it is stored.
   */
  function setAdminPin(pin) {
    var text = String(pin || '').trim();
    if (text.length < MIN_PIN_LENGTH_) {
      ApiError.fail(
        'weak_pin',
        'The admin PIN needs at least ' + MIN_PIN_LENGTH_ + ' characters.'
      );
    }
    Properties.setProp(Constants.PROPS.ADMIN_PIN_HASH, pinHash_(text));
    return true;
  }

  /**
   * Forgets the wrong tries, which lifts a lock. Called from the sheet menu.
   *
   * @return {boolean} True when the admin page was locked.
   */
  function unlockAdmin() {
    var cache = CacheService.getScriptCache();
    var locked = failCount_(cache) >= ADMIN_MAX_FAILS;
    cache.remove(Constants.CACHE.ADMIN_FAILS);
    return locked;
  }

  /**
   * Lets a request through only with the admin PIN. A wrong PIN counts
   * toward the lock, and the right one forgets the wrong tries.
   *
   * @param {?Object} req The request; `admin.pin` holds the PIN.
   * @return {boolean} True when the PIN is right; otherwise it throws.
   */
  function requireAdmin(req) {
    var stored = Properties.getProp(Constants.PROPS.ADMIN_PIN_HASH);
    if (!stored) {
      ApiError.fail(
        'not_configured',
        'Set the admin PIN from the Forms Platform menu first.'
      );
    }
    var cache = CacheService.getScriptCache();
    var fails = failCount_(cache);
    if (fails >= ADMIN_MAX_FAILS) {
      ApiError.fail(
        'locked',
        'Too many wrong PINs. Wait ten minutes, or unlock the admin page ' +
          'from the Forms Platform menu in the sheet.'
      );
    }
    var pin = req?.admin?.pin;
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
