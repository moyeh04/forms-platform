/** The transfer actions of the team leader and of the admin. */

var TransfersController = (function () {
/**
 * Answers the `transfer.decide` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function transferDecide(req) {
  var form = FormsRepository.requireForm(String(req.slug || ''));
  var vform = FormsPublic.validationForm(form);
  var found = KeysService.findByKey(form, req.key);
  var out = Lock.withLock(function () {
    return TransfersService.decideTransfer(
      vform,
      req.id,
      !!req.approve,
      'leader',
      found.id,
      req.handover
    );
  });
  ResponsesNotify.afterChange(form);
  TransfersMail.mailDecision(vform, out);
  var fresh = ResponsesRepository.readResponses(form).filter(function (r) {
    return r.id === found.id;
  })[0];
  return {
    submission: SubmissionsController.publicSubmission(fresh),
    transfers: TransfersService.teamTransfers(vform, fresh),
    underMin: out.underMin
  };
}

/**
 * Answers the `transfer.cancel` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function cancel(req) {
  var form = FormsRepository.requireForm(String(req.slug || ''));
  var vform = FormsPublic.validationForm(form);
  var found = KeysService.findByKey(form, req.key);
  Lock.withLock(function () {
    var t = TransfersRepository.readTransfers(form).filter(function (x) {
      return (
        x.id === String(req.id) && x.status === 'pending' && x.toId === found.id
      );
    })[0];
    if (!t) ApiError.fail('transfer_gone', 'This request was already answered.');
    t.status = 'cancelled';
    TransfersRepository.saveTransfer(form, t);
  });
  return { transfers: TransfersService.teamTransfers(vform, found) };
}

/** The waiting requests, with the names the dashboard shows and, for a leader, who can lead next. */
function adminTransfers_(form) {
  var waiting = TransfersRepository.readTransfers(form).filter(function (t) {
    return t.status === 'pending';
  });
  var rows = waiting.length ? ResponsesRepository.readResponses(form) : [];
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
      TransfersService.leaderAsked(form, from, t.code)
    );
  });
}

/**
 * Answers the `admin.transfer.decide` action.
 *
 * @param {!Object} req The request body.
 * @return {*} The answer, sent back as JSON.
 */
function adminTransferDecide(req) {
  var form = FormsRepository.requireForm(req.slug || req.id);
  var vform = FormsPublic.validationForm(form);
  var out = Lock.withLock(function () {
    return TransfersService.decideTransfer(
      vform,
      req.transfer,
      !!req.approve,
      'admin',
      '',
      req.handover
    );
  });
  ResponsesNotify.afterChange(form);
  TransfersMail.mailDecision(vform, out);
  return { transfers: adminTransfers_(form), underMin: out.underMin };
}

return { adminTransfers: adminTransfers_, transferDecide, cancel, adminTransferDecide };
})();
