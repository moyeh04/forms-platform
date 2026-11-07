/**
 * Trusted devices of the admin. A browser that signed in with the right PIN
 * keeps a random pass; the script stores only its salted hash and the time
 * it was made. A request with a known pass is counted on its own, so wrong
 * PINs from strangers cannot lock the admin out of a device that already
 * signed in. A pass ends after the number of days set from the sheet menu.
 */

var AuthDevices = (function () {
  /** The hex digits of a pass: two UUIDs without their dashes. */
  var PASS_LENGTH_ = 64;

  /** How many days a pass lasts when the sheet menu did not set it. */
  var DEFAULT_DAYS_ = 30;

  /**
   * Hashes a pass with the secret pepper.
   *
   * @param {string} pass The pass.
   * @return {string} The hash the script stores.
   */
  function passHash_(pass) {
    return Crypto.sha256Hex(Properties.pepper() + ':device:' + pass);
  }

  /**
   * Reads how many days a pass lasts.
   *
   * @return {number} The days.
   */
  function days() {
    var set = parseInt(
      Properties.getProp(Constants.PROPS.ADMIN_DEVICE_DAYS),
      10
    );
    return set > 0 ? set : DEFAULT_DAYS_;
  }

  /**
   * Sets how many days a pass lasts. It counts from when each pass was
   * made, so a shorter time also ends older passes.
   *
   * @param {*} n The days, a whole number of at least one.
   * @return {number} The days stored.
   * @throws {ApiError} `invalid` when it is not such a number.
   */
  function setDays(n) {
    var text = String(n ?? '').trim();
    if (!/^\d+$/.test(text) || Number(text) < 1) {
      ApiError.fail('invalid', 'Type a whole number of days, 1 or more.');
    }
    Properties.setProp(Constants.PROPS.ADMIN_DEVICE_DAYS, text);
    return Number(text);
  }

  /**
   * Says whether a pass made at a time has ended.
   *
   * @param {?string} made When the pass was made, as an ISO time.
   * @return {boolean} True when it is older than the days a pass lasts.
   */
  function expired_(made) {
    var t = Date.parse(made || '');
    return !(t > 0) || Time.nowIso() > Time.isoAfterDays(t, days());
  }

  /**
   * Reads every stored pass.
   *
   * @return {!Object<string, string>} When each was made, by its hash.
   */
  function stored_() {
    var prefix = Constants.PROPS.ADMIN_DEVICE_PREFIX;
    var all = PropertiesService.getScriptProperties().getProperties();
    var out = {};
    Object.keys(all).forEach(function (k) {
      if (k.indexOf(prefix) === 0) out[k.slice(prefix.length)] = all[k];
    });
    return out;
  }

  /**
   * Forgets a pass.
   *
   * @param {string} hash Its hash.
   */
  function forget_(hash) {
    PropertiesService.getScriptProperties().deleteProperty(
      Constants.PROPS.ADMIN_DEVICE_PREFIX + hash
    );
  }

  /**
   * Finds the stored hash of a pass. An ended pass is forgotten.
   *
   * @param {*} pass The pass a request carried.
   * @return {?string} Its hash when the pass is known and has not ended,
   *     otherwise null.
   */
  function known(pass) {
    if (typeof pass !== 'string' || pass.length !== PASS_LENGTH_) return null;
    var hash = passHash_(pass);
    var made = Properties.getProp(Constants.PROPS.ADMIN_DEVICE_PREFIX + hash);
    if (!made) return null;
    if (!expired_(made)) return hash;
    forget_(hash);
    return null;
  }

  /**
   * Makes a new pass and remembers its hash. Ended passes of other browsers
   * are forgotten on the way.
   *
   * @return {string} The pass, given to the browser once.
   */
  function issue() {
    var all = stored_();
    Object.keys(all).forEach(function (h) {
      if (expired_(all[h])) forget_(h);
    });
    var pass = (Crypto.uuid() + Crypto.uuid()).replace(/-/g, '');
    Properties.setProp(
      Constants.PROPS.ADMIN_DEVICE_PREFIX + passHash_(pass),
      Time.nowIso()
    );
    return pass;
  }

  /**
   * Lists the hashes of every stored pass.
   *
   * @return {!Array<string>} The hashes.
   */
  function hashes() {
    return Object.keys(stored_());
  }

  /**
   * Forgets every pass, so each device needs the PIN again to get one.
   *
   * @return {number} How many passes there were.
   */
  function forgetAll() {
    var all = hashes();
    all.forEach(forget_);
    return all.length;
  }

  return { known, issue, hashes, forgetAll, days, setDays };
})();
