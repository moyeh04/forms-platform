/** The transfer actions of the team leader and of the admin. */

var TransfersController = (function () {
  /**
   * Answers the `transfer.decide` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function transferDecide(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    var vform = FormsPublic.validationForm(form);
    var found = KeysService.findByKey(form, req.key);
    var out = Lock.withLock(function () {
      return TransferDecision.decide(vform, req.id, {
        approve: !!req.approve,
        by: 'leader',
        fromId: found.id,
        next: req.handover
      });
    });
    ResponsesNotify.afterChange(form);
    TransfersMail.mailDecision(vform, out);
    var fresh = TransfersService.findTeam(form, found.id);
    return {
      submission: SubmissionsService.publicSubmission(fresh),
      transfers: TransfersView.teamTransfers(vform, fresh),
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
    var form = FormsService.requireForm(String(req.slug || ''));
    var vform = FormsPublic.validationForm(form);
    var found = KeysService.findByKey(form, req.key);
    Lock.withLock(function () {
      TransfersService.cancelTransfer(form, req.id, found.id);
    });
    return { transfers: TransfersView.teamTransfers(vform, found) };
  }

  /**
   * Answers the `admin.transfer.decide` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function adminTransferDecide(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    var vform = FormsPublic.validationForm(form);
    var out = Lock.withLock(function () {
      return TransferDecision.decide(vform, req.transfer, {
        approve: !!req.approve,
        by: 'admin',
        fromId: '',
        next: req.handover
      });
    });
    ResponsesNotify.afterChange(form);
    TransfersMail.mailDecision(vform, out);
    return {
      transfers: TransfersView.adminTransfers(form),
      underMin: out.underMin
    };
  }

  return { transferDecide, cancel, adminTransferDecide };
})();
