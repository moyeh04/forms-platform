/**
 * The admin side of submissions: the list, changes to review, status and
 * answers, and resetting or showing a key.
 */

var AdminSubmissionsService = (function () {
  /**
   * Gives what the admin sees of a submission: everything but its row and
   * key, and whether its key can be shown.
   *
   * @param {!Object} r The submission.
   * @return {!Object} The view.
   */
  function adminView_(r) {
    var o = Json.clone(r);
    o.keyKnown = !!(r.keyHash && r.keySeal);
    delete o._row;
    delete o.keyHash;
    delete o.keySeal;
    return o;
  }

  /**
   * Finds a submission among rows.
   *
   * @param {!Array<!Object>} rows The submissions.
   * @param {*} id The id to find.
   * @return {!Object} The submission.
   * @throws {ApiError} `submission_not_found` when none has the id.
   */
  function requireSubmission_(rows, id) {
    var r = rows.filter(function (x) {
      return x.id === id;
    })[0];
    if (!r)
      ApiError.fail('submission_not_found', 'That submission does not exist.');
    return r;
  }

  /**
   * Lists the submissions of a form for the admin, with their team numbers.
   * A reservation form with its teammates turned off shows none.
   *
   * @param {!Object} form The form.
   * @param {boolean} includeDeleted True to keep cancelled ones.
   * @return {!Array<!Object>} The admin views.
   */
  function adminRows_(form, includeDeleted) {
    var noMembers =
      form.type === FormType.RESERVATION &&
      Rules.fieldByRole(form, 'members').enabled === false;
    return TeamNumbers.numberedResponses(form, includeDeleted).map(
      function (r) {
        var view = adminView_(r);
        if (noMembers) {
          view.data.members = [];
          view.members = '';
        }
        return view;
      }
    );
  }

  /**
   * Applies the review steps of an admin change.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The submission, changed in place.
   * @param {!Object<string, string>} review The new status of some steps.
   * @throws {ApiError} `bad_step` for a step the form does not have.
   */
  function patchReview_(form, r, review) {
    var steps = form.review?.steps || [];
    var ids = steps.map(function (s) {
      return s.id;
    });
    Object.keys(review).forEach(function (k) {
      if (ids.indexOf(k) === -1)
        ApiError.fail('bad_step', 'Unknown review step.');
    });
    steps.forEach(function (s) {
      if (review[s.id] !== undefined)
        ResponsesReview.setReviewStep(form, r, s.id, review[s.id]);
    });
  }

  /**
   * Sets the status of a submission.
   *
   * @param {!Object} r The submission, changed in place.
   * @param {*} status The new status.
   * @throws {ApiError} `bad_status` for an unknown status.
   */
  function patchStatus_(r, status) {
    if (ResponsesRepository.SUBMISSION_STATUSES.indexOf(status) === -1)
      ApiError.fail('bad_status', 'Unknown status.');
    r.status = status;
  }

  /**
   * Replaces the answers of a submission with checked ones.
   *
   * @param {!Object} vform The form as it validates.
   * @param {!Object} r The submission, changed in place.
   * @param {!Object} answers The new answers.
   * @param {!Array<!Object>} live The live submissions.
   * @throws {ApiError} `invalid`, or a broken limit.
   */
  function patchData_(vform, r, answers, live) {
    var v = Rules.validateSubmission(vform, answers);
    if (!v.ok) ApiError.fail('invalid', 'Some answers need fixing.', v.errors);
    ResponsesRules.checkLimits(vform, v.data, live, r.id);
    r.data = v.data;
    ResponsesRepository.applyDerived(vform, r);
  }

  /**
   * Applies an admin change to a submission: review steps, status and
   * answers.
   *
   * @param {!Object} form The form.
   * @param {!Object} vform The form as it validates.
   * @param {*} id The id of the submission.
   * @param {!Object} patch The change.
   * @return {boolean} True when the answers changed.
   * @throws {ApiError} `submission_not_found`, `bad_step`, `bad_status` or
   *     `invalid`.
   */
  function patchSubmission_(form, vform, id, patch) {
    return Lock.withLock(function () {
      var live = ResponsesRepository.readResponses(form);
      var r = requireSubmission_(live, id);
      if (patch.review) patchReview_(form, r, patch.review);
      if (patch.status !== undefined) patchStatus_(r, patch.status);
      if (patch.data) patchData_(vform, r, patch.data, live);
      ResponsesRepository.saveResponse(form, r);
      return !!patch.data;
    });
  }

  /**
   * Gives a submission a new key.
   *
   * @param {!Object} form The form.
   * @param {!Object} vform The form as it validates.
   * @param {*} id The id of the submission.
   * @return {{key: string, keyExpires: string, ref: string}} The new key.
   */
  function resetKey_(form, vform, id) {
    return Lock.withLock(function () {
      var rows = ResponsesRepository.readResponses(form);
      var r = requireSubmission_(rows, id);
      var k = KeysService.issueKey(vform, rows);
      r.keyHash = k.hash;
      r.keySeal = KeysService.sealKey(form, r.id, k.key);
      r.keyExpires = KeysService.keyExpiry(form);
      ResponsesRepository.saveResponse(form, r);
      return { key: k.key, keyExpires: r.keyExpires, ref: r.ref };
    });
  }

  /**
   * Opens the current key of a submission, for example when the student
   * lost it.
   *
   * @param {!Object} form The form.
   * @param {*} id The id of the submission.
   * @return {!Object} The key, its end, the ref and whether it ended.
   * @throws {ApiError} `key_unknown` for a key issued before keys were
   *     sealed.
   */
  function shownKey_(form, id) {
    var r = requireSubmission_(ResponsesRepository.readResponses(form), id);
    var key = KeysService.unsealKey(form, r.id, r.keySeal);
    if (!key || KeysService.keyHash(form, key) !== r.keyHash)
      ApiError.fail(
        'key_unknown',
        'This key was issued before keys could be shown. ' +
          'Reset it to give the student a new one you can see.'
      );
    return {
      key: key,
      keyExpires: r.keyExpires,
      ref: r.ref,
      expired: KeysService.keyExpired(r)
    };
  }

  return {
    adminView: adminView_,
    adminRows: adminRows_,
    patchSubmission: patchSubmission_,
    resetKey: resetKey_,
    shownKey: shownKey_
  };
})();
