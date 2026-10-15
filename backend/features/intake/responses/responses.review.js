/** The review steps of a submission and its review status. */

function defaultReview_(form) {
  var out = {};
  ((form.review && form.review.steps) || []).forEach(function (s) {
    out[s.id] = 'pending';
  });
  return out;
}

var REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

/** new -> in_review -> approved, or rejected as soon as any step is rejected. */
function reviewStatus_(steps, review) {
  var vals = steps.map(function (s) {
    return review[s.id] || 'pending';
  });
  if (!vals.length) return null;
  if (vals.indexOf('rejected') !== -1) return 'rejected';
  if (
    vals.every(function (v) {
      return v === 'approved';
    })
  )
    return 'approved';
  if (vals.indexOf('approved') !== -1) return 'in_review';
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
  if (idx < 0) fail('bad_step', 'Unknown review step.');
  if (REVIEW_STATUSES.indexOf(status) === -1)
    fail('bad_status', 'Unknown review status.');
  var sequential = form.review.sequential !== false;
  if (
    sequential &&
    status === 'approved' &&
    idx > 0 &&
    r.review[steps[idx - 1].id] !== 'approved'
  ) {
    fail('review_order', 'Finish "' + steps[idx - 1].label.en + '" first.');
  }
  r.review[stepId] = status;
  if (sequential && status !== 'approved') {
    for (var i = idx + 1; i < steps.length; i++)
      if (r.review[steps[i].id] === 'approved')
        r.review[steps[i].id] = 'pending';
  }
  var derived = reviewStatus_(steps, r.review);
  if (derived) r.status = derived;
}
