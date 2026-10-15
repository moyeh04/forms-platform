/**
 * Edit keys: issuing, sealing, expiring and finding a submission by its key.
 */

var KeysService = (function () {
  function keyHash_(form, key) {
    return Crypto.sha256Hex(
      Properties.pepper() + ':key:' + form.id + ':' + key
    );
  }

  /**
   * A sealed copy of a key that only this script can open, so the admin can
   * look a lost key up. Each digit is shifted by a pad derived from the private
   * pepper, the form, and the registration: the sheet alone reveals nothing.
   */
  function keyPad_(form, responseId) {
    return Crypto.sha256Hex(
      Properties.pepper() + ':seal:' + form.id + ':' + responseId
    );
  }

  function sealKey_(form, responseId, key) {
    return Crypto.sealDigits(keyPad_(form, responseId), key);
  }

  function unsealKey_(form, responseId, seal) {
    return Crypto.unsealDigits(keyPad_(form, responseId), seal, 5);
  }

  function issueKey_(form, rows) {
    var used = {};
    rows.forEach(function (r) {
      if (!r.deleted && r.keyHash) used[r.keyHash] = true;
    });
    for (var i = 0; i < 60; i++) {
      var key = Crypto.randomDigits(5);
      var h = keyHash_(form, key);
      if (!used[h]) return { key: key, hash: h };
    }
    ApiError.fail(
      'keys_exhausted',
      'No free edit keys are left for this form.'
    );
  }

  /** A booking made with a registration key is opened by that same key, unless another booking already holds it. */
  function bookingKey_(form, rows, key) {
    key = String(key || '').trim();
    var hash = keyHash_(form, key);
    var used = rows.some(function (r) {
      return !r.deleted && r.keyHash === hash;
    });
    return used ? issueKey_(form, rows) : { key: key, hash: hash };
  }

  function keyExpiry_(form) {
    var days = (form.editKey && form.editKey.days) || 7;
    return new Date(Date.now() + days * 86400000).toISOString();
  }

  function requireKeyEnabled_(form) {
    if (!form.editKey || !form.editKey.enabled)
      ApiError.fail(
        'key_disabled',
        'Editing with a key is turned off for this form.'
      );
  }

  /** Finds the registration a key belongs to. Wrong guesses are throttled. `anyAge` accepts a key that has expired. */
  function findByKey_(form, key, anyAge) {
    requireKeyEnabled_(form);
    var cache = CacheService.getScriptCache();
    var tag = 'badkey:' + form.id;
    var fails = parseInt(cache.get(tag) || '0', 10);
    if (fails >= 10)
      ApiError.fail(
        'too_many_attempts',
        'Too many wrong keys. Wait a minute and try again.'
      );
    key = String(key || '').trim();
    var h = /^\d{5}$/.test(key) ? keyHash_(form, key) : '';
    var hit = null;
    ResponsesRepository.readResponses(form).forEach(function (r) {
      if (h && r.keyHash === h) hit = r;
    });
    if (!hit) {
      cache.put(tag, String(fails + 1), 60);
      ApiError.fail('bad_key', 'That key is not right.');
    }
    if (!anyAge && hit.keyExpires && Date.parse(hit.keyExpires) < Date.now())
      ApiError.fail(
        'key_expired',
        'This key has expired. Ask your instructor to extend it, or to make the change for you.'
      );
    return hit;
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
    keyPad: keyPad_
  };
})();
