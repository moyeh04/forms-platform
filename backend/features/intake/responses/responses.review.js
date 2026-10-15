/** The review steps of a submission and its review status. */

var ResponsesReview = (function () {
  /**
   * Gives the review of a new submission: every step pending.
   *
   * @param {!Object} form The form.
   * @return {!Object<string, string>} The status of each step by id.
   */
  function defaultReview_(form) {
    var out = {};
    (form.review?.steps || []).forEach(function (s) {
      out[s.id] = ReviewStatus.PENDING;
    });
    return out;
  }

  /**
   * Gives the status the review steps add up to: new, then in_review, then
   * approved, or rejected as soon as any step is rejected.
   *
   * @param {!Array<!Object>} steps The review steps of the form.
   * @param {!Object<string, string>} review The status of each step.
   * @return {?string} The status, or null when the form has no steps.
   */
  function reviewStatus_(steps, review) {
    var vals = steps.map(function (s) {
      return review[s.id] || ReviewStatus.PENDING;
    });
    if (!vals.length) return null;
    if (vals.indexOf(ReviewStatus.REJECTED) !== -1) return 'rejected';
    if (
      vals.every(function (v) {
        return v === ReviewStatus.APPROVED;
      })
    )
      return 'approved';
    if (vals.indexOf(ReviewStatus.APPROVED) !== -1) return 'in_review';
    return 'new';
  }

  /**
   * Finds a review step and checks the status it is given.
   *
   * @param {!Array<!Object>} steps The review steps of the form.
   * @param {string} stepId The step.
   * @param {string} status Its new status.
   * @return {number} The place of the step.
   * @throws {ApiError} `bad_step` or `bad_status`.
   */
  function stepIndex_(steps, stepId, status) {
    var idx = steps
      .map(function (s) {
        return s.id;
      })
      .lastIndexOf(stepId);
    if (idx < 0) ApiError.fail('bad_step', 'Unknown review step.');
    if (Object.values(ReviewStatus).indexOf(status) === -1)
      ApiError.fail('bad_status', 'Unknown review status.');
    return idx;
  }

  /**
   * Sends the approvals after a step back to pending.
   *
   * @param {!Array<!Object>} steps The review steps of the form.
   * @param {!Object<string, string>} review The review, changed in place.
   * @param {number} idx The place of the step.
   */
  function reopenLater_(steps, review, idx) {
    steps.slice(idx + 1).forEach(function (s) {
      if (review[s.id] === ReviewStatus.APPROVED)
        review[s.id] = ReviewStatus.PENDING;
    });
  }

  /**
   * Sets one review step. When steps are sequential, a later step can only be
   * approved after the earlier one, and un-approving an earlier step sends
   * later approvals back to pending.
   *
   * @param {!Object} form The form.
   * @param {!Object} r The submission, changed in place.
   * @param {string} stepId The step.
   * @param {string} status Its new status.
   * @throws {ApiError} `bad_step`, `bad_status` or `review_order`.
   */
  function setReviewStep_(form, r, stepId, status) {
    var steps = form.review?.steps || [];
    var idx = stepIndex_(steps, stepId, status);
    var sequential = form.review.sequential !== false;
    var approving = status === ReviewStatus.APPROVED;
    var before = steps[idx - 1];
    if (
      sequential &&
      approving &&
      before &&
      r.review[before.id] !== ReviewStatus.APPROVED
    )
      ApiError.fail('review_order', 'Finish "' + before.label.en + '" first.');
    r.review[stepId] = status;
    if (sequential && !approving) reopenLater_(steps, r.review, idx);
    var derived = reviewStatus_(steps, r.review);
    if (derived) r.status = derived;
  }

  return {
    setReviewStep: setReviewStep_,
    defaultReview: defaultReview_
  };
})();
