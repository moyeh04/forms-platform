/** The WhatsApp matching actions of the admin: import, list, decide, remove. */

var MatchingController = (function () {
  /**
   * Answers the `admin.matching.import` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function importNumbers(req) {
    var form = MatchingService.requireMatchingForm(req.slug || req.id);
    return MatchingService.importNumbers(form, req.text);
  }

  /**
   * Answers the `admin.matching.list` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function list(req) {
    var form = MatchingService.requireMatchingForm(req.slug || req.id);
    var match = MatchingService.matchList(form);
    return {
      requests: match.requests,
      submissions: match.submissions.map(AdminSubmissionsService.adminView),
      notRequested: match.notRequested
    };
  }

  /**
   * Answers the `admin.matching.decide` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function decide(req) {
    var form = MatchingService.requireMatchingForm(req.slug || req.id);
    var decision = String(req.decision);
    if (Object.values(ReviewStatus).indexOf(decision) === -1)
      ApiError.fail(
        'bad_status',
        'Decision must be pending, approved, or rejected.'
      );
    var linked = MatchingService.decide(
      form,
      req.requestId,
      decision,
      req.note
    );
    if (linked) ResponsesNotify.afterChange(form);
    return { decided: true, submissionId: linked };
  }

  /**
   * Answers the `admin.matching.remove` action.
   *
   * @param {!Object} req The request body.
   * @return {*} The answer, sent back as JSON.
   */
  function remove(req) {
    var form = MatchingService.requireMatchingForm(req.slug || req.id);
    return { removed: MatchingService.remove(form, req.requestIds || []) };
  }

  return { importNumbers, list, decide, remove };
})();
