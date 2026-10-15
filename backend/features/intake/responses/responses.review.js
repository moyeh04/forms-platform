/** The review steps of a submission and its review status. */

var ResponsesReview = (function () {
  function defaultReview_(form) {
    var out = {};
    ((form.review && form.review.steps) || []).forEach(function (s) {
      out[s.id] = ReviewStatus.PENDING;
    });
    return out;
  }

  /** new -> in_review -> approved, or rejected as soon as any step is rejected. */
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
   * Sets one review step. When steps are sequential, a later step can only be
   * approved after the earlier one, and un-approving an earlier step sends
   * later approvals back to pending.
   */
  function setReviewStep_(form, r, stepId, status) {
    var steps = (form.review && form.review.steps) || [];
    var idx = -1;
    steps.forEach(function (s, i) {
      if (s.id === stepId) idx = i;
    });
    if (idx < 0) ApiError.fail('bad_step', 'Unknown review step.');
    if (Object.values(ReviewStatus).indexOf(status) === -1)
      ApiError.fail('bad_status', 'Unknown review status.');
    var sequential = form.review.sequential !== false;
    if (
      sequential &&
      status === ReviewStatus.APPROVED &&
      idx > 0 &&
      r.review[steps[idx - 1].id] !== ReviewStatus.APPROVED
    ) {
      ApiError.fail(
        'review_order',
        'Finish "' + steps[idx - 1].label.en + '" first.'
      );
    }
    r.review[stepId] = status;
    if (sequential && status !== ReviewStatus.APPROVED) {
      for (var i = idx + 1; i < steps.length; i++)
        if (r.review[steps[i].id] === ReviewStatus.APPROVED)
          r.review[steps[i].id] = ReviewStatus.PENDING;
    }
    var derived = reviewStatus_(steps, r.review);
    if (derived) r.status = derived;
  }

  return {
    setReviewStep: setReviewStep_,
    defaultReview: defaultReview_
  };
})();
