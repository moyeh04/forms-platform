/** The transfer actions of the team leader and of the admin. */

var API = API || {};

API['transfer.decide'] = function (req) {
  var form = requireForm(String(req.slug || ''));
  var vform = validationForm(form);
  var found = findByKey_(form, req.key);
  var out = withLock_(function () {
    return decideTransfer_(
      vform,
      req.id,
      !!req.approve,
      'leader',
      found.id,
      req.handover
    );
  });
  afterChange_(form);
  mailDecision_(vform, out);
  var fresh = readResponses(form).filter(function (r) {
    return r.id === found.id;
  })[0];
  return {
    submission: publicSubmission_(fresh),
    transfers: teamTransfers_(vform, fresh),
    underMin: out.underMin
  };
};

API['transfer.cancel'] = function (req) {
  var form = requireForm(String(req.slug || ''));
  var vform = validationForm(form);
  var found = findByKey_(form, req.key);
  withLock_(function () {
    var t = readTransfers_(form).filter(function (x) {
      return (
        x.id === String(req.id) && x.status === 'pending' && x.toId === found.id
      );
    })[0];
    if (!t) fail('transfer_gone', 'This request was already answered.');
    t.status = 'cancelled';
    saveTransfer_(form, t);
  });
  return { transfers: teamTransfers_(vform, found) };
};

/** The waiting requests, with the names the dashboard shows and, for a leader, who can lead next. */
function adminTransfers_(form) {
  var waiting = readTransfers_(form).filter(function (t) {
    return t.status === 'pending';
  });
  var rows = waiting.length ? readResponses(form) : [];
  return waiting.map(function (t) {
    var from = rows.filter(function (r) {
      return r.id === t.fromId;
    })[0];
    return Object.assign(
      {
        id: t.id,
        created: t.created,
        code: t.code,
        name: t.member.name || '',
        from: t.fromRef,
        to: t.toRef
      },
      leaderAsked_(form, from, t.code)
    );
  });
}

API['admin.transfer.decide'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  var vform = validationForm(form);
  var out = withLock_(function () {
    return decideTransfer_(
      vform,
      req.transfer,
      !!req.approve,
      'admin',
      '',
      req.handover
    );
  });
  afterChange_(form);
  mailDecision_(vform, out);
  return { transfers: adminTransfers_(form), underMin: out.underMin };
});
