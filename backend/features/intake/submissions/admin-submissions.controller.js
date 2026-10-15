/**
 * The admin actions on submissions: list, edit, delete and reset or show a key.
 */

var API = API || {};

function adminView_(r) {
  var o = Json.clone(r);
  o.keyKnown = !!(r.keyHash && r.keySeal);
  delete o._row;
  delete o.keyHash;
  delete o.keySeal;
  return o;
}

API['admin.submissions'] = AuthService.admin(function (req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  var rows = TeamNumbers.numberedResponses(form, !!req.includeDeleted).map(function (r) {
    var view = adminView_(r);
    if (
      form.type === 'reservation' &&
      Rules.fieldByRole(form, 'members').enabled === false
    ) {
      view.data.members = [];
      view.members = '';
    }
    return view;
  });
  return { submissions: rows, transfers: adminTransfers_(form) };
});

API['admin.submission.update'] = AuthService.admin(function (req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  var vform = FormsPublic.validationForm(form);
  var patch = req.patch || {};
  var changedData = false;
  Lock.withLock(function () {
    var live = ResponsesRepository.readResponses(form);
    var r = live.filter(function (x) {
      return x.id === req.submissionId;
    })[0];
    if (!r) ApiError.fail('submission_not_found', 'That submission does not exist.');
    if (patch.review) {
      var steps = (form.review && form.review.steps) || [];
      Object.keys(patch.review).forEach(function (k) {
        if (
          !steps.some(function (s) {
            return s.id === k;
          })
        )
          ApiError.fail('bad_step', 'Unknown review step.');
      });
      steps.forEach(function (s) {
        if (patch.review[s.id] !== undefined)
          ResponsesReview.setReviewStep(form, r, s.id, patch.review[s.id]);
      });
    }
    if (patch.status !== undefined) {
      if (ResponsesRepository.SUBMISSION_STATUSES.indexOf(patch.status) === -1)
        ApiError.fail('bad_status', 'Unknown status.');
      r.status = patch.status;
    }
    if (patch.data) {
      var v = Rules.validateSubmission(vform, patch.data);
      if (!v.ok) ApiError.fail('invalid', 'Some answers need fixing.', v.errors);
      ResponsesRules.checkLimits(vform, v.data, live, r.id);
      r.data = v.data;
      ResponsesRepository.applyDerived(vform, r);
      changedData = true;
    }
    ResponsesRepository.saveResponse(form, r);
  });
  ResponsesNotify.afterChange(form);
  return { updated: true, dataChanged: changedData };
});

API['admin.submission.delete'] = AuthService.admin(function (req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  Lock.withLock(function () {
    if (!cancelResponse_(form, req.submissionId))
      ApiError.fail('submission_not_found', 'That submission does not exist.');
  });
  ResponsesNotify.afterChange(form);
  return { deleted: true };
});

API['admin.submission.resetKey'] = AuthService.admin(function (req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  var vform = FormsPublic.validationForm(form);
  return Lock.withLock(function () {
    var rows = ResponsesRepository.readResponses(form);
    var r = rows.filter(function (x) {
      return x.id === req.submissionId;
    })[0];
    if (!r) ApiError.fail('submission_not_found', 'That submission does not exist.');
    var k = KeysService.issueKey(vform, rows);
    r.keyHash = k.hash;
    r.keySeal = KeysService.sealKey(form, r.id, k.key);
    r.keyExpires = KeysService.keyExpiry(form);
    ResponsesRepository.saveResponse(form, r);
    return { key: k.key, keyExpires: r.keyExpires, ref: r.ref };
  });
});

/** The admin reads a student's current key, for example when the student lost it. */
API['admin.submission.key'] = AuthService.admin(function (req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  var r = ResponsesRepository.readResponses(form).filter(function (x) {
    return x.id === req.submissionId;
  })[0];
  if (!r) ApiError.fail('submission_not_found', 'That submission does not exist.');
  var key = KeysService.unsealKey(form, r.id, r.keySeal);
  if (!key || KeysService.keyHash(form, key) !== r.keyHash)
    ApiError.fail(
      'key_unknown',
      'This key was issued before keys could be shown. Reset it to give the student a new one you can see.'
    );
  return {
    key: key,
    keyExpires: r.keyExpires,
    ref: r.ref,
    expired: !!(r.keyExpires && Date.parse(r.keyExpires) < Date.now())
  };
});
