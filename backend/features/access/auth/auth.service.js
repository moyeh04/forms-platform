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
  var ADMIN_LOCK_SECONDS = 1800;

  /** The shortest PIN the admin may set. */
  var MIN_PIN_LENGTH_ = 4;

  /** The milliseconds in a second. */
  var MS_PER_SECOND_ = 1000;

  /**
   * Reads the message set from the sheet menu, kept in a script property so
   * it lives with the owner and not in the source.
   *
   * @return {string} The message, or '' when none is set.
   */
  function lockMessage() {
    return Properties.getProp(Constants.PROPS.LOCKED_MESSAGE) || "";
  }

  /**
   * Sets what the shared lock answers, from the sheet menu. Only a stranger
   * meets it: the admin's own browser holds a pass and is counted apart.
   * Empty goes back to the plain message, which gives the time left.
   *
   * @param {*} text The message; paragraphs are separated by an empty line.
   * @return {boolean} True when a message of its own is set.
   */
  function setLockMessage(text) {
    var t = String(text ?? "")
      .replace(/\r\n?/g, "\n")
      .trim();
    if (!t) {
      PropertiesService.getScriptProperties().deleteProperty(Constants.PROPS.LOCKED_MESSAGE);
      return false;
    }
    Properties.setProp(Constants.PROPS.LOCKED_MESSAGE, t);
    return true;
  }

  /**
   * Hashes a PIN with the secret pepper.
   *
   * @param {*} pin The PIN.
   * @return {string} The hash the script stores.
   */
  function pinHash_(pin) {
    return Crypto.sha256Hex(Properties.pepper() + ":admin:" + pin);
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
   * Reads a counter of wrong PINs. It is kept as `count|untilMs`: the cache
   * cannot say when an entry ends, so the counter carries that instant.
   *
   * @param {!CacheService.Cache} cache The script cache.
   * @param {string} key The counter.
   * @return {{count: number, untilMs: number}} The wrong tries remembered
   *     now, and when they are forgotten.
   */
  function readFails_(cache, key) {
    var parts = (cache.get(key) || "0").split("|");
    return { count: parseInt(parts[0], 10), untilMs: Number(parts[1]) || 0 };
  }

  /**
   * Counts one more wrong PIN, which starts the lock time again.
   *
   * @param {!CacheService.Cache} cache The script cache.
   * @param {string} key The counter.
   * @param {number} count The wrong tries, this one included.
   * @return {{count: number, untilMs: number}} The counter as stored.
   */
  function countFail_(cache, key, count) {
    var untilMs = Date.now() + ADMIN_LOCK_SECONDS * MS_PER_SECOND_;
    cache.put(key, count + "|" + untilMs, ADMIN_LOCK_SECONDS);
    return { count, untilMs };
  }

  /**
   * Refuses a request because its counter is full. The details carry the
   * time left, so the page counts it down and a script reads it.
   *
   * @param {?string} device The hash of the request's known pass, or null.
   * @param {number} untilMs When the counter is forgotten.
   * @throws {ApiError} `device_locked` for a trusted device, else `locked`.
   */
  function failLocked_(device, untilMs) {
    var seconds = Math.max(0, Math.ceil((untilMs - Date.now()) / MS_PER_SECOND_));
    var details = { seconds, until: new Date(untilMs).toISOString() };
    var left = Time.clockText(seconds);
    if (device) {
      ApiError.fail(
        "device_locked",
        "Too many wrong PINs on this device. Try again in " +
          left +
          ", or unlock the admin page from the Forms Platform menu in the " +
          "sheet.",
        details,
      );
    }
    ApiError.fail(
      "locked",
      lockMessage() || "Too many wrong PINs. Try again in " + left + ".",
      details,
    );
  }

  /**
   * Stores a new admin PIN and forgets every trusted device. Called from the
   * sheet menu.
   *
   * @param {*} pin The new PIN.
   * @return {boolean} True once it is stored.
   */
  function setAdminPin(pin) {
    var text = String(pin || "").trim();
    if (text.length < MIN_PIN_LENGTH_) {
      ApiError.fail("weak_pin", "The admin PIN needs at least " + MIN_PIN_LENGTH_ + " characters.");
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
      return readFails_(cache, k).count >= ADMIN_MAX_FAILS;
    });
    keys.forEach(function (k) {
      cache.remove(k);
    });
    return locked;
  }

  /**
   * Lets a request through only with the admin PIN. A wrong PIN counts
   * toward the lock of its counter, and the one that fills it is already
   * refused as locked; the right PIN forgets the wrong tries.
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
      ApiError.fail("not_configured", "Set the admin PIN from the Forms Platform menu first.");
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
    var fails = readFails_(cache, key);
    if (fails.count >= ADMIN_MAX_FAILS) failLocked_(device, fails.untilMs);
    var pin = req?.admin?.pin;
    if (!pin || pinHash_(pin) !== stored) {
      fails = countFail_(cache, key, fails.count + 1);
      if (fails.count >= ADMIN_MAX_FAILS) failLocked_(device, fails.untilMs);
      ApiError.fail("bad_pin", "That PIN is not correct.");
    }
    cache.remove(key);
    return true;
  }

  return {
    requireAdmin,
    setAdminPin,
    unlockAdmin,
    lockMessage,
    setLockMessage,
    pinHash: pinHash_,
  };
})();
