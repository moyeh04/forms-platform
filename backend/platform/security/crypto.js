/** Ids, random digits, SHA-256 and the sealing of short digit strings. */

var Crypto = (function () {
  /** How many hex digits of a fresh id a short id keeps. */
  var SHORT_ID_DIGITS_ = 8;

  /** The number of values a byte holds, to read a signed byte as 0 to 255. */
  var BYTE_VALUES_ = 256;

  /** Hex is base sixteen. */
  var HEX_ = 16;

  /** Decimal digits are base ten. */
  var DECIMAL_ = 10;

  /** The letter a sealed digit string starts with. */
  var SEAL_MARK_ = 'S';

  /**
   * Makes a fresh random id.
   *
   * @return {string} A UUID.
   */
  function uuid() {
    return Utilities.getUuid();
  }

  /**
   * Makes a short random id after a prefix, for ids people may read.
   *
   * @param {string} prefix What the id starts with, such as `c_`.
   * @return {string} The prefix and eight hex digits.
   */
  function shortId(prefix) {
    return prefix + uuid().replace(/-/g, '').slice(0, SHORT_ID_DIGITS_);
  }

  /**
   * Hashes text with SHA-256.
   *
   * @param {*} s The text.
   * @return {string} The hash as 64 lower-case hex digits.
   */
  function sha256Hex(s) {
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(s)
    );
    return bytes
      .map(function (b) {
        var value = (b + BYTE_VALUES_) % BYTE_VALUES_;
        return ('0' + value.toString(HEX_)).slice(-2);
      })
      .join('');
  }

  /**
   * Makes a string of random decimal digits.
   *
   * @param {number} n How many digits.
   * @return {string} The digits.
   */
  function randomDigits(n) {
    var s = '';
    var i;
    for (i = 0; i < n; i++) s += Math.floor(Math.random() * DECIMAL_);
    return s;
  }

  /**
   * Seals a digit string: shifts each digit by the matching hex digit of a
   * pad, so only the script, which can make the pad again, can open it. The
   * edit keys of registrations and the access keys of links use it.
   *
   * @param {string} pad Hex digits at least as long as the key.
   * @param {*} key The digits.
   * @return {string} `S` and the shifted digits.
   */
  function sealDigits_(pad, key) {
    return (
      SEAL_MARK_ +
      String(key)
        .split('')
        .map(function (d, i) {
          var shift = parseInt(pad.charAt(i), HEX_);
          return String((parseInt(d, DECIMAL_) + shift) % DECIMAL_);
        })
        .join('')
    );
  }

  /**
   * Opens a sealed digit string with the pad it was sealed with.
   *
   * @param {string} pad The pad of `sealDigits`.
   * @param {*} seal The sealed string.
   * @param {number} length How many digits the key has.
   * @return {string} The digits, or an empty string when the seal is not a
   *     seal of that length.
   */
  function unsealDigits_(pad, seal, length) {
    var s = String(seal || '');
    if (!new RegExp('^' + SEAL_MARK_ + '\\d{' + length + '}$').test(s)) {
      return '';
    }
    return s
      .slice(1)
      .split('')
      .map(function (d, i) {
        var shift = parseInt(pad.charAt(i), HEX_);
        var back = (parseInt(d, DECIMAL_) - shift) % DECIMAL_;
        return String((back + DECIMAL_) % DECIMAL_);
      })
      .join('');
  }

  return {
    uuid,
    sha256Hex,
    shortId,
    unsealDigits: unsealDigits_,
    sealDigits: sealDigits_,
    randomDigits
  };
})();
