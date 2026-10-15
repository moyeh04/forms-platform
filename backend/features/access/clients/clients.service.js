/**
 * Read-only access for instructors and clients through private links.
 * A link contains a random token; only its salted hash is stored, so a
 * leaked spreadsheet cannot be used to open anyone's view.
 *
 * A link can also need an access key: six digits the admin sends apart from
 * the link, so a link that is forwarded or leaked opens nothing on its own.
 * Only the salted hash of the key is stored, with a sealed copy only this
 * script can open so the admin can look a lost key up. Wrong keys lock the
 * link for a while. A link made before keys existed has none and opens as
 * before.
 *
 * A link can end on a date (`expires`); after it, the link and its key open
 * nothing until the admin moves the date.
 *
 * A link shows the warnings about small teams of its forms unless the admin
 * switches them off for it (`showSizeAlerts`). Links made before the switch
 * existed show them.
 *
 * A link names its forms by id, so renaming a form's link name does not take
 * the form away from it. Links saved with link names are read as ids and
 * stored as ids on their next save.
 */

var ClientsService = (function () {
  /** How many digits an access key has. */
  var KEY_DIGITS = 6;

  /** How many hex digits of a fresh id an access key is made from. */
  var KEY_SOURCE_HEX_ = 10;

  /** Hex is base sixteen. */
  var HEX_ = 16;

  /** How many characters a link token has. */
  var TOKEN_LENGTH_ = 24;

  /**
   * Hashes the token of a link.
   *
   * @param {string} token The token.
   * @return {string} The hash stored in the `tokenHash` column.
   */
  function clientToken_(token) {
    return Crypto.sha256Hex(Properties.pepper() + ':client:' + token);
  }

  /**
   * Hashes the access key of a link.
   *
   * @param {!Object} c The link.
   * @param {string} key The key.
   * @return {string} The hash stored in the `keyHash` column.
   */
  function clientKeyHash_(c, key) {
    return Crypto.sha256Hex(
      Properties.pepper() + ':clientkey:' + c.id + ':' + key
    );
  }

  /**
   * Makes the pad that seals the access key of a link.
   *
   * @param {!Object} c The link.
   * @return {string} The pad, as hex digits.
   */
  function clientKeyPad_(c) {
    return Crypto.sha256Hex(Properties.pepper() + ':clientseal:' + c.id);
  }

  /**
   * Gives a link an access key, or no key when it is empty.
   *
   * @param {!Object} c The link, changed in place.
   * @param {string} key The key, or an empty string.
   */
  function setClientKey_(c, key) {
    c.keyHash = key ? clientKeyHash_(c, key) : '';
    c.keySeal = key ? Crypto.sealDigits(clientKeyPad_(c), key) : '';
  }

  /**
   * Says whether a link has ended.
   *
   * @param {!Object} c The link.
   * @return {boolean} True when its end date has passed.
   */
  function clientExpired_(c) {
    return !!(c.expires && Date.parse(c.expires) < Date.now());
  }

  /**
   * Reads an end date from the admin.
   *
   * @param {*} value The date as sent.
   * @return {string} An ISO time, or empty for no end.
   * @throws {ApiError} `bad_date` when it is not a date.
   */
  function cleanExpiry_(value) {
    var v = String(value || '').trim();
    if (!v) return '';
    var t = Date.parse(v);
    if (Number.isNaN(t))
      ApiError.fail('bad_date', 'That end date is not a date.');
    return new Date(t).toISOString();
  }

  /**
   * Makes a random access key.
   *
   * @return {string} KEY_DIGITS digits.
   */
  function newClientKey_() {
    var hex = Crypto.uuid().replace(/-/g, '').slice(0, KEY_SOURCE_HEX_);
    var n = parseInt(hex, HEX_) % 10 ** KEY_DIGITS;
    return String(n).padStart(KEY_DIGITS, '0');
  }

  /**
   * Makes a random link token.
   *
   * @return {string} TOKEN_LENGTH_ hex digits.
   */
  function newToken_() {
    return (Crypto.uuid() + Crypto.uuid())
      .replace(/-/g, '')
      .slice(0, TOKEN_LENGTH_);
  }

  /**
   * Gives what the admin sees of a link: everything but its hashes.
   *
   * @param {!Object} c The link.
   * @return {!Object} The view.
   */
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

  /**
   * Turns the forms the admin chose into form ids.
   *
   * @param {*} list Slugs or ids, or `*` for every form.
   * @return {!Array<string>} The ids, or `['*']`.
   * @throws {ApiError} `form_not_found` for a form that does not exist.
   */
  function cleanClientForms_(list) {
    list = Array.isArray(list) ? list : [];
    if (list.indexOf('*') !== -1) return ['*'];
    return list.map(function (s) {
      var f = FormsRepository.findForm(String(s));
      if (!f)
        ApiError.fail('form_not_found', 'Form "' + s + '" does not exist.');
      return f.id;
    });
  }

  return {
    KEY_DIGITS,
    clientToken: clientToken_,
    clientExpired: clientExpired_,
    clientKeyHash: clientKeyHash_,
    publicClient: publicClient_,
    newToken: newToken_,
    cleanClientForms: cleanClientForms_,
    cleanExpiry: cleanExpiry_,
    newClientKey: newClientKey_,
    setClientKey: setClientKey_,
    clientKeyPad: clientKeyPad_
  };
})();
