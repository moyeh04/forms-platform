/**
 * The admin actions on submissions: list, edit, delete and reset or show a
 * key.
 */

var AdminSubmissionsController = (function () {
  /**
   * Answers the `admin.submissions` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function submissions(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    return {
      submissions: AdminSubmissionsService.adminRows(
        form,
        !!req.includeDeleted
      ),
      transfers: TransfersView.adminTransfers(form)
    };
  }

  /**
   * Answers the `admin.submission.update` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function update(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    var changedData = AdminSubmissionsService.patchSubmission(
      form,
      FormsPublic.validationForm(form),
      req.submissionId,
      req.patch || {}
    );
    ResponsesNotify.afterChange(form);
    return { updated: true, dataChanged: changedData };
  }

  /**
   * Answers the `admin.submission.delete` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function remove(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    if (!SubmissionsService.cancelSubmission(form, req.submissionId))
      ApiError.fail('submission_not_found', 'That submission does not exist.');
    ResponsesNotify.afterChange(form);
    return { deleted: true };
  }

  /**
   * Answers the `admin.submission.resetKey` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function resetKey(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    return AdminSubmissionsService.resetKey(
      form,
      FormsPublic.validationForm(form),
      req.submissionId
    );
  }

  /**
   * Answers the `admin.submission.key` action: the admin reads a student's
   * current key, for example when the student lost it.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function submissionKey(req) {
    var form = FormsService.requireForm(req.slug || req.id);
    return AdminSubmissionsService.shownKey(form, req.submissionId);
  }

  return { submissions, update, remove, resetKey, submissionKey };
})();
