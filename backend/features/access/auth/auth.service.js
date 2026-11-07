/**
 * Admin access. The PIN is stored only as a salted hash and every wrong
 * guess counts toward a temporary lock, so the PIN cannot be brute forced.
 * Wrong guesses from unknown browsers share one count; a browser that holds
 * a trusted-device pass (AuthDevices) has a count of its own.
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
   * The cache key that counts the wrong PINs of a request.
   *
   * @param {?string} device The hash of the request's known pass, or null.
   * @return {string} The device's own key, or the shared one.
   */
  function failKey_(device) {
    return device
      ? Constants.CACHE.ADMIN_DEVICE_FAILS_PREFIX + device
      : Constants.CACHE.ADMIN_FAILS;
  }

  /**
   * Reads how many wrong PINs a counter holds.
   *
   * @param {!CacheService.Cache} cache The script cache.
   * @param {string} key The counter.
   * @return {number} The wrong tries remembered now.
   */
  function failCount_(cache, key) {
    return parseInt(cache.get(key) || '0', 10);
  }

  /**
   * Stores a new admin PIN and forgets every trusted device. Called from the
   * sheet menu.
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
    AuthDevices.forgetAll();
    return true;
  }

  /**
   * Forgets the wrong tries, the shared ones and every device's, which lifts
   * any lock. Called from the sheet menu.
   *
   * @return {boolean} True when something was locked.
   */
  function unlockAdmin() {
    var cache = CacheService.getScriptCache();
    var keys = [failKey_(null)].concat(AuthDevices.hashes().map(failKey_));
    var locked = keys.some(function (k) {
      return failCount_(cache, k) >= ADMIN_MAX_FAILS;
    });
    keys.forEach(function (k) {
      cache.remove(k);
    });
    return locked;
  }

  /**
   * Lets a request through only with the admin PIN. A wrong PIN counts
   * toward the lock of its counter, and the right one forgets the wrong
   * tries.
   *
   * The count is read, checked and written under the script lock, so PINs
   * sent at the same time are counted one after another: a burst of
   * guesses cannot all read the same count and slip past the limit.
   *
   * @param {?Object} req The request; `admin.pin` holds the PIN and
   *     `admin.device` the pass of a trusted device.
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
    return Lock.withLock(function () {
      return checkPin_(req, stored);
    });
  }

  /**
   * Checks one PIN against the count of wrong tries: refuses it when the
   * count is full, counts it when wrong, and forgets the count when right.
   * Call it inside Lock.withLock.
   *
   * @param {?Object} req The request, as requireAdmin takes it.
   * @param {string} stored The stored PIN hash.
   * @return {boolean} True when the PIN is right; otherwise it throws.
   */
  function checkPin_(req, stored) {
    var device = AuthDevices.known(req?.admin?.device);
    var key = failKey_(device);
    var cache = CacheService.getScriptCache();
    var fails = failCount_(cache, key);
    if (fails >= ADMIN_MAX_FAILS && device) {
      ApiError.fail(
        'device_locked',
        'Too many wrong PINs on this device. Wait ten minutes, or unlock ' +
          'the admin page from the Forms Platform menu in the sheet.'
      );
    }
    if (fails >= ADMIN_MAX_FAILS) {
      ApiError.fail(
        'locked',
        'Too many wrong PINs. Wait ten minutes, or unlock the admin page ' +
          'from the Forms Platform menu in the sheet.'
      );
    }
    var pin = req?.admin?.pin;
    if (!pin || pinHash_(pin) !== stored) {
      cache.put(key, String(fails + 1), ADMIN_LOCK_SECONDS);
      ApiError.fail('bad_pin', 'That PIN is not correct.');
    }
    cache.remove(key);
    return true;
  }

  return { requireAdmin, setAdminPin, unlockAdmin, pinHash: pinHash_ };
})();
