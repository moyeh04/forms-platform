/** The student actions: submit, look up, update and cancel a submission. */

var SubmissionsController = (function () {
  /**
   * Answers the `submit` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function submit(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    ResponsesRules.assertAcceptingSubmissions(form);
    var vform = FormsPublic.validationForm(form);
    var source = KeyBookingService.keyBookingSource(form);
    var data = source
      ? SubmissionsService.keyBookingAnswers(
          vform,
          source,
          req.sourceKey,
          req.data
        )
      : SubmissionsService.checkedAnswers(vform, req.data);
    var result = SubmissionsService.addSubmission(form, vform, data, {
      source: source,
      sourceKey: req.sourceKey,
      transfer: req.transfer
    });
    ResponsesNotify.afterChange(form);
    result.emailed = ResponsesNotify.sendConfirmation(vform, result, data);
    return SubmissionsService.transferResult(vform, result, data);
  }

  /**
   * Answers the `lookup` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function lookup(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    var r = KeysService.findByKey(form, req.key);
    var locked = SubmissionsService.taskLocked(form);
    var scope = SubmissionsService.editScope(form);
    return {
      submission: SubmissionsService.publicSubmission(r),
      transfers: TransfersService.teamTransfers(
        FormsPublic.validationForm(form),
        r
      ),
      keyExpires: r.keyExpires,
      canEdit: !!scope,
      slotOnly: scope === 'slot',
      canDelete: !!form.editKey.allowDelete && !locked,
      locked: locked
    };
  }

  /**
   * Answers the `update` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function update(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    var vform = FormsPublic.validationForm(form);
    var found = KeysService.findByKey(form, req.key);
    SubmissionsService.assertTaskOpen(form);
    var scope = SubmissionsService.editScope(form);
    if (!scope)
      ApiError.fail('edit_disabled', 'Editing is turned off for this form.');
    var data =
      scope === 'slot'
        ? KeyBookingService.movedBooking(vform, found.data, req.data || {})
        : SubmissionsService.checkedAnswers(vform, req.data);
    var asked = SubmissionsService.editSubmission(form, vform, found.id, {
      data: data,
      transfer: req.transfer
    });
    ResponsesNotify.afterChange(form);
    return SubmissionsService.transferResult(
      vform,
      { ref: found.ref, asked: asked },
      data
    );
  }

  /**
   * Answers the `remove` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function remove(req) {
    var form = FormsService.requireForm(String(req.slug || ''));
    var found = KeysService.findByKey(form, req.key);
    if (!form.editKey.allowDelete)
      ApiError.fail('delete_disabled', 'Deleting is turned off for this form.');
    SubmissionsService.assertTaskOpen(form);
    if (!SubmissionsService.cancelSubmission(form, found.id))
      ApiError.fail('bad_key', 'That key is not right.');
    ResponsesNotify.afterChange(form);
    return { removed: true, ref: found.ref };
  }

  return { submit, lookup, update, remove };
})();
