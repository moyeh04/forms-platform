/**
 * Edit keys: issuing, sealing, expiring and finding a submission by its key,
 * and moving the date keys stop working for one, some or all of a form's
 * registrations. A key gets new time from today or from its end date,
 * whichever is later, so an expired key works again for the whole period.
 */

var KeysService = (function () {
  /** How many digits an edit key has. */
  var KEY_DIGITS_ = 5;

  /** How many random keys to try before a form counts as full. */
  var ISSUE_TRIES_ = 60;

  /** How many days a key works when the form does not say. */
  var DEFAULT_KEY_DAYS_ = 7;

  /** How many wrong keys a form takes before it waits. */
  var MAX_BAD_KEYS_ = 10;

  /** How long the count of wrong keys lasts, in seconds. */
  var BAD_KEY_WINDOW_S_ = 60;

  /** What a typed key must look like. */
  var KEY_PATTERN_ = new RegExp('^\\d{' + KEY_DIGITS_ + '}$');

  /**
   * Hashes a key of a form.
   *
   * @param {!Object} form The form.
   * @param {string} key The key.
   * @return {string} The hash stored in the `keyHash` column.
   */
  function keyHash_(form, key) {
    return Crypto.sha256Hex(
      Properties.pepper() + ':key:' + form.id + ':' + key
    );
  }

  /**
   * Makes the pad that seals the key of one registration. A sealed copy of a
   * key can be opened only by this script, so the admin can look a lost key
   * up. Each digit is shifted by a pad made from the private pepper, the form
   * and the registration: the sheet alone reveals nothing.
   *
   * @param {!Object} form The form.
   * @param {string} responseId The id of the registration.
   * @return {string} The pad, as hex digits.
   */
  function keyPad_(form, responseId) {
    return Crypto.sha256Hex(
      Properties.pepper() + ':seal:' + form.id + ':' + responseId
    );
  }

  /**
   * Seals the key of a registration.
   *
   * @param {!Object} form The form.
   * @param {string} responseId The id of the registration.
   * @param {string} key The key.
   * @return {string} The sealed key.
   */
  function sealKey_(form, responseId, key) {
    return Crypto.sealDigits(keyPad_(form, responseId), key);
  }

  /**
   * Opens the sealed key of a registration.
   *
   * @param {!Object} form The form.
   * @param {string} responseId The id of the registration.
   * @param {*} seal The sealed key.
   * @return {string} The key, or an empty string when the seal is not one.
   */
  function unsealKey_(form, responseId, seal) {
    return Crypto.unsealDigits(keyPad_(form, responseId), seal, KEY_DIGITS_);
  }

  /**
   * Makes a key no live registration of the form holds.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>} rows The responses of the form.
   * @return {{key: string, hash: string}} The key and its hash.
   * @throws {ApiError} `keys_exhausted` when no free key was found.
   */
  function issueKey_(form, rows) {
    var used = {};
    var i;
    var key;
    var h;
    rows.forEach(function (r) {
      if (!r.deleted && r.keyHash) used[r.keyHash] = true;
    });
    for (i = 0; i < ISSUE_TRIES_; i++) {
      key = Crypto.randomDigits(KEY_DIGITS_);
      h = keyHash_(form, key);
      if (!used[h]) return { key: key, hash: h };
    }
    ApiError.fail(
      'keys_exhausted',
      'No free edit keys are left for this form.'
    );
  }

  /**
   * Gives the key of a booking. A booking made with a registration key is
   * opened by that same key, unless another booking already holds it.
   *
   * @param {!Object} form The booking form.
   * @param {!Array<!Object>} rows Its responses.
   * @param {*} key The registration key.
   * @return {{key: string, hash: string}} The key and its hash.
   */
  function bookingKey_(form, rows, key) {
    key = String(key || '').trim();
    var hash = keyHash_(form, key);
    var used = rows.some(function (r) {
      return !r.deleted && r.keyHash === hash;
    });
    return used ? issueKey_(form, rows) : { key: key, hash: hash };
  }

  /**
   * Gives the end of a new key of the form.
   *
   * @param {!Object} form The form.
   * @return {string} The instant the key stops working, in ISO form.
   */
  function keyExpiry_(form) {
    var days = form.editKey?.days || DEFAULT_KEY_DAYS_;
    return Time.isoAfterDays(Date.now(), days);
  }

  /**
   * Refuses a form whose edit keys are turned off.
   *
   * @param {!Object} form The form.
   * @throws {ApiError} `key_disabled` when keys are off.
   */
  function requireKeyEnabled_(form) {
    if (!form.editKey?.enabled)
      ApiError.fail(
        'key_disabled',
        'Editing with a key is turned off for this form.'
      );
  }

  /**
   * Finds the registration a key belongs to. Wrong guesses are throttled.
   *
   * @param {!Object} form The form.
   * @param {*} key The typed key.
   * @param {boolean=} anyAge True to accept a key that has expired.
   * @return {!Object} The registration.
   * @throws {ApiError} `too_many_attempts`, `bad_key` or `key_expired`.
   */
  function findByKey_(form, key, anyAge) {
    requireKeyEnabled_(form);
    var cache = CacheService.getScriptCache();
    var tag = Constants.CACHE.BAD_KEY_PREFIX + form.id;
    var fails = parseInt(cache.get(tag) || '0', 10);
    if (fails >= MAX_BAD_KEYS_)
      ApiError.fail(
        'too_many_attempts',
        'Too many wrong keys. Wait a minute and try again.'
      );
    key = String(key || '').trim();
    var h = KEY_PATTERN_.test(key) ? keyHash_(form, key) : '';
    var hit = null;
    ResponsesRepository.readResponses(form).forEach(function (r) {
      if (h && r.keyHash === h) hit = r;
    });
    if (!hit) {
      cache.put(tag, String(fails + 1), BAD_KEY_WINDOW_S_);
      ApiError.fail('bad_key', 'That key is not right.');
    }
    if (!anyAge && keyExpired_(hit))
      ApiError.fail(
        'key_expired',
        'This key has expired. ' +
          'Ask your instructor to extend it, or to make the change for you.'
      );
    return hit;
  }

  /**
   * Says whether the key of a registration has stopped working.
   *
   * @param {!Object} r The registration.
   * @return {boolean} True when its end date has passed.
   */
  function keyExpired_(r) {
    return !!(r.keyExpires && Date.parse(r.keyExpires) < Date.now());
  }

  /**
   * Makes the row of one key for the admin page.
   *
   * @param {!Object} r The registration.
   * @return {!Object} Its id, ref, name, title, key end and whether it ended.
   */
  function keyRow_(r) {
    return {
      id: r.id,
      ref: r.ref,
      name: String(r.name || ''),
      title: String(r.title || ''),
      keyExpires: r.keyExpires,
      expired: keyExpired_(r)
    };
  }

  /**
   * Reads the registrations of a form that hold a key.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} The registrations.
   */
  function keyedRows_(form) {
    return ResponsesRepository.readResponses(form).filter(function (r) {
      return r.keyHash;
    });
  }

  /**
   * Lists the keys of a form for the admin page.
   *
   * @param {!Object} form The form.
   * @return {!Array<!Object>} One row for each key.
   */
  function listKeys_(form) {
    return keyedRows_(form).map(keyRow_);
  }

  /**
   * Gives the new end of one key.
   *
   * @param {string} current Its end now.
   * @param {number} days The days to add to the later of now and its end.
   * @param {string} until An end to use as given instead, or empty.
   * @return {string} The new end, in ISO form.
   */
  function extendedExpiry_(current, days, until) {
    if (until) return until;
    return Time.isoAfterDays(
      Math.max(Date.now(), Date.parse(current) || 0),
      days
    );
  }

  /**
   * Moves the end of some keys of a form.
   *
   * @param {!Object} form The form.
   * @param {string} which `all`, `expired` or `chosen`.
   * @param {!Array<string>} ids The chosen registrations, for `chosen`.
   * @param {{days: number, until: string}} span The days to add, or the end
   *     to set.
   * @return {number} How many keys it changed.
   * @throws {ApiError} `submission_not_found` when a chosen registration is
   *     gone.
   */
  function extendKeys_(form, which, ids, span) {
    return Lock.withLock(function () {
      var picked = keyedRows_(form).filter(function (r) {
        if (which === 'all') return true;
        if (which === 'expired') return keyExpired_(r);
        return ids.indexOf(r.id) !== -1;
      });
      if (which === 'chosen' && picked.length !== ids.length)
        ApiError.fail(
          'submission_not_found',
          'A chosen registration no longer exists. Open the list again.'
        );
      picked.forEach(function (r) {
        r.keyExpires = extendedExpiry_(r.keyExpires, span.days, span.until);
        ResponsesRepository.saveResponse(form, r);
      });
      return picked.length;
    });
  }

  return {
    requireKeyEnabled: requireKeyEnabled_,
    findByKey: findByKey_,
    issueKey: issueKey_,
    sealKey: sealKey_,
    keyExpiry: keyExpiry_,
    unsealKey: unsealKey_,
    keyHash: keyHash_,
    bookingKey: bookingKey_,
    keyPad: keyPad_,
    keyExpired: keyExpired_,
    listKeys: listKeys_,
    extendKeys: extendKeys_
  };
})();
