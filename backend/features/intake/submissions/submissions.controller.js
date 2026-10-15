/** The student actions: submit, look up, update and cancel a submission. */

var API = API || {};

function publicSubmission_(r) {
  return {
    ref: r.ref,
    status: r.status,
    created: r.created,
    updated: r.updated,
    data: r.data
  };
}

API.submit = function (req) {
  var form = requireForm(String(req.slug || ''));
  assertAcceptingSubmissions_(form);
  var vform = validationForm(form);
  var source = keyBookingSource_(form);
  var v,
    registration = null;
  if (source) {
    // The answers come from the registration the key opens; the student only picks the slot.
    registration = registrationByKey_(source, req.sourceKey);
    var slotField = Rules.fieldByRole(vform, 'slot');
    v = {
      ok: true,
      data: bookingData_(
        vform,
        source,
        registration,
        (req.data || {})[slotField.id]
      )
    };
    v.data._source = { form: source.id, ref: registration.ref };
  } else {
    v = Rules.validateSubmission(vform, req.data || {});
    if (!v.ok) ApiError.fail('invalid', 'Some answers need fixing.', v.errors);
    checkDriveFields_(vform, v.data);
  }

  var result = withLock_(function () {
    var rows = readResponses(form, true);
    var live = rows.filter(function (r) {
      return !r.deleted;
    });
    // Members that another team holds are asked for, not saved with this team.
    var wants = source
      ? []
      : takeOutTransfers_(vform, v.data, live, null, req.transfer);
    try {
      checkLimits_(vform, v.data, live, null);
    } catch (e) {
      if (source && e.code === 'duplicate')
        ApiError.fail(
          'already_booked',
          'Your team already has a booking. Open it with your key to change its time.'
        );
      throw e;
    }
    var k = source
      ? bookingKey_(vform, live, req.sourceKey)
      : issueKey_(vform, live);
    var id = uuid();
    var r = applyDerived_(vform, {
      id: id,
      ref: nextRef_(form),
      created: nowIso(),
      status: 'new',
      review: defaultReview_(form),
      data: v.data,
      keyHash: k.hash,
      keyExpires: keyExpiry_(form),
      deleted: false,
      keySeal: sealKey_(form, id, k.key)
    });
    rows.push(r);
    keepTeamNumbers_(form, rows);
    saveResponse_(form, r);
    var asked = recordTransfers_(form, r, wants);
    return {
      id: r.id,
      ref: r.ref,
      key: form.editKey.enabled ? k.key : '',
      keyExpires: r.keyExpires,
      asked: asked
    };
  });

  afterChange_(form);
  result.emailed = sendConfirmation_(vform, result, v.data);
  return transferResult_(vform, result, v.data);
};

/**
 * A task is handed in by its deadline: once the form stops taking answers, a key still opens
 * the task but can no longer change or cancel it. Opening the form again lifts the lock.
 */
function taskLocked_(form) {
  return form.type === 'task_submission' && Rules.formState(form) !== 'open';
}

function assertTaskOpen_(form) {
  if (taskLocked_(form))
    ApiError.fail(
      'deadline_passed',
      'The deadline has passed, so this task can no longer be changed.'
    );
}

/**
 * What a key may change: 'all', 'slot' or nothing (''). A booking that may be cancelled may
 * also move to another time, since cancelling and booking again does the same. A booking made
 * with a team's key holds that team's answers, so only its slot ever changes.
 */
function editScope_(form) {
  if (taskLocked_(form)) return '';
  var edit = !!form.editKey.allowEdit;
  if (form.type !== 'reservation') return edit ? 'all' : '';
  if (keyBookingSource_(form))
    return edit || form.editKey.allowDelete ? 'slot' : '';
  return edit ? 'all' : form.editKey.allowDelete ? 'slot' : '';
}

API.lookup = function (req) {
  var form = requireForm(String(req.slug || ''));
  var r = findByKey_(form, req.key);
  var locked = taskLocked_(form);
  var scope = editScope_(form);
  return {
    submission: publicSubmission_(r),
    transfers: teamTransfers_(validationForm(form), r),
    keyExpires: r.keyExpires,
    canEdit: !!scope,
    slotOnly: scope === 'slot',
    canDelete: !!form.editKey.allowDelete && !locked,
    locked: locked
  };
};

API.update = function (req) {
  var form = requireForm(String(req.slug || ''));
  var vform = validationForm(form);
  var found = findByKey_(form, req.key);
  assertTaskOpen_(form);
  var scope = editScope_(form);
  if (!scope) ApiError.fail('edit_disabled', 'Editing is turned off for this form.');
  var v;
  if (scope === 'slot') {
    v = { ok: true, data: movedBooking_(vform, found.data, req.data || {}) };
  } else {
    v = Rules.validateSubmission(vform, req.data || {});
    if (!v.ok) ApiError.fail('invalid', 'Some answers need fixing.', v.errors);
    checkDriveFields_(vform, v.data);
  }

  var asked = withLock_(function () {
    var live = readResponses(form);
    var current = live.filter(function (r) {
      return r.id === found.id;
    })[0];
    if (!current) ApiError.fail('bad_key', 'That key is not right.');
    var wants = takeOutTransfers_(
      vform,
      v.data,
      live,
      current.id,
      req.transfer
    );
    checkLimits_(vform, v.data, live, current.id);
    current.data = v.data;
    applyDerived_(vform, current);
    saveResponse_(form, current);
    return recordTransfers_(form, current, wants);
  });

  afterChange_(form);
  return transferResult_(vform, { ref: found.ref, asked: asked }, v.data);
};

API.remove = function (req) {
  var form = requireForm(String(req.slug || ''));
  var found = findByKey_(form, req.key);
  if (!form.editKey.allowDelete)
    ApiError.fail('delete_disabled', 'Deleting is turned off for this form.');
  assertTaskOpen_(form);
  withLock_(function () {
    if (!cancelResponse_(form, found.id))
      ApiError.fail('bad_key', 'That key is not right.');
  });
  afterChange_(form);
  return { removed: true, ref: found.ref };
};

/**
 * Finishes a save that asked for members of other teams: emails their leaders, and returns the
 * saved answers, which no longer hold those members.
 */
function transferResult_(form, result, data) {
  var asked = result.asked || [];
  delete result.asked;
  if (!asked.length) return result;
  asked.forEach(function (t) {
    mailTransfer_(form, t, 'asked');
  });
  var contact = leaderContacts_(form);
  result.data = data;
  result.transfers = asked.map(function (t) {
    return Object.assign(
      { code: t.code, name: t.member.name || '', team: t.fromRef },
      contact(t.fromId)
    );
  });
  return result;
}

/**
 * Cancels a live registration: the row stays, marked deleted, without its key, and its member
 * requests are closed. A team keeps its number, so the teams after it do not move up. Returns
 * the row, or null when there is no such live registration. Call it inside withLock_.
 */
function cancelResponse_(form, id) {
  var rows = readResponses(form, true);
  var r = rows.filter(function (x) {
    return x.id === id && !x.deleted;
  })[0];
  if (!r) return null;
  keepTeamNumbers_(form, rows);
  r.deleted = true;
  r.keyHash = '';
  r.keySeal = '';
  saveResponse_(form, r);
  closeTransfersOf_(form, r.id);
  return r;
}
