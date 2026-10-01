/** Public submission, edit-with-key, and admin submission management. */

var API = API || {};

function publicSubmission_(r) {
  return { ref: r.ref, status: r.status, created: r.created, updated: r.updated, data: r.data };
}

API.submit = function (req) {
  var form = requireForm(String(req.slug || ''));
  assertAcceptingSubmissions_(form);
  var vform = validationForm(form);
  var v = Rules.validateSubmission(vform, req.data || {});
  if (!v.ok) fail('invalid', 'Some answers need fixing.', v.errors);
  checkDriveFields_(vform, v.data);

  var result = withLock_(function () {
    var rows = readResponses(form, true);
    var live = rows.filter(function (r) { return !r.deleted; });
    checkLimits_(vform, v.data, live, null);
    var k = issueKey_(vform, live);
    var id = uuid();
    var r = applyDerived_(vform, {
      id: id, ref: nextRef_(form), created: nowIso(), status: 'new', review: defaultReview_(form),
      data: v.data, keyHash: k.hash, keyExpires: keyExpiry_(form), deleted: false, keySeal: sealKey_(form, id, k.key)
    });
    saveResponse_(form, r);
    return { id: r.id, ref: r.ref, key: form.editKey.enabled ? k.key : '', keyExpires: r.keyExpires };
  });

  afterChange_(form);
  result.emailed = sendConfirmation_(vform, result, v.data);
  return result;
};

API.lookup = function (req) {
  var form = requireForm(String(req.slug || ''));
  var r = findByKey_(form, req.key);
  return {
    submission: publicSubmission_(r),
    keyExpires: r.keyExpires,
    canEdit: !!form.editKey.allowEdit,
    canDelete: !!form.editKey.allowDelete
  };
};

API.update = function (req) {
  var form = requireForm(String(req.slug || ''));
  var vform = validationForm(form);
  var found = findByKey_(form, req.key);
  if (!form.editKey.allowEdit) fail('edit_disabled', 'Editing is turned off for this form.');
  var v = Rules.validateSubmission(vform, req.data || {});
  if (!v.ok) fail('invalid', 'Some answers need fixing.', v.errors);
  checkDriveFields_(vform, v.data);

  withLock_(function () {
    var live = readResponses(form);
    var current = live.filter(function (r) { return r.id === found.id; })[0];
    if (!current) fail('bad_key', 'That key is not right.');
    checkLimits_(vform, v.data, live, current.id);
    current.data = v.data;
    applyDerived_(vform, current);
    saveResponse_(form, current);
  });

  afterChange_(form);
  return { ref: found.ref };
};

API.remove = function (req) {
  var form = requireForm(String(req.slug || ''));
  var found = findByKey_(form, req.key);
  if (!form.editKey.allowDelete) fail('delete_disabled', 'Deleting is turned off for this form.');
  withLock_(function () {
    var current = readResponses(form).filter(function (r) { return r.id === found.id; })[0];
    if (!current) fail('bad_key', 'That key is not right.');
    current.deleted = true;
    current.keyHash = '';
    current.keySeal = '';
    saveResponse_(form, current);
  });
  afterChange_(form);
  return { removed: true, ref: found.ref };
};

/* ── Admin ────────────────────────────────────────────────────── */

function adminView_(r) {
  var o = clone(r);
  o.keyKnown = !!(r.keyHash && r.keySeal);
  delete o._row;
  delete o.keyHash;
  delete o.keySeal;
  return o;
}

API['admin.submissions'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  var rows = readResponses(form, !!req.includeDeleted).map(adminView_);
  return { submissions: rows };
});

API['admin.submission.update'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  var vform = validationForm(form);
  var patch = req.patch || {};
  var changedData = false;
  withLock_(function () {
    var live = readResponses(form);
    var r = live.filter(function (x) { return x.id === req.submissionId; })[0];
    if (!r) fail('submission_not_found', 'That submission does not exist.');
    if (patch.review) {
      var steps = (form.review && form.review.steps) || [];
      Object.keys(patch.review).forEach(function (k) {
        if (!steps.some(function (s) { return s.id === k; })) fail('bad_step', 'Unknown review step.');
      });
      steps.forEach(function (s) {
        if (patch.review[s.id] !== undefined) setReviewStep_(form, r, s.id, patch.review[s.id]);
      });
    }
    if (patch.status !== undefined) {
      if (SUBMISSION_STATUSES.indexOf(patch.status) === -1) fail('bad_status', 'Unknown status.');
      r.status = patch.status;
    }
    if (patch.data) {
      var v = Rules.validateSubmission(vform, patch.data);
      if (!v.ok) fail('invalid', 'Some answers need fixing.', v.errors);
      checkLimits_(vform, v.data, live, r.id);
      r.data = v.data;
      applyDerived_(vform, r);
      changedData = true;
    }
    saveResponse_(form, r);
  });
  afterChange_(form);
  return { updated: true, dataChanged: changedData };
});

API['admin.submission.delete'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  withLock_(function () {
    var r = readResponses(form).filter(function (x) { return x.id === req.submissionId; })[0];
    if (!r) fail('submission_not_found', 'That submission does not exist.');
    r.deleted = true;
    r.keyHash = '';
    r.keySeal = '';
    saveResponse_(form, r);
  });
  afterChange_(form);
  return { deleted: true };
});

API['admin.submission.resetKey'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  var vform = validationForm(form);
  return withLock_(function () {
    var rows = readResponses(form);
    var r = rows.filter(function (x) { return x.id === req.submissionId; })[0];
    if (!r) fail('submission_not_found', 'That submission does not exist.');
    var k = issueKey_(vform, rows);
    r.keyHash = k.hash;
    r.keySeal = sealKey_(form, r.id, k.key);
    r.keyExpires = keyExpiry_(form);
    saveResponse_(form, r);
    return { key: k.key, keyExpires: r.keyExpires, ref: r.ref };
  });
});

/** The admin reads a student's current key, for example when the student lost it. */
API['admin.submission.key'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  var r = readResponses(form).filter(function (x) { return x.id === req.submissionId; })[0];
  if (!r) fail('submission_not_found', 'That submission does not exist.');
  var key = unsealKey_(form, r.id, r.keySeal);
  if (!key || keyHash_(form, key) !== r.keyHash) fail('key_unknown', 'This key was issued before keys could be shown. Reset it to give the student a new one you can see.');
  return { key: key, keyExpires: r.keyExpires, ref: r.ref, expired: !!(r.keyExpires && Date.parse(r.keyExpires) < Date.now()) };
});
