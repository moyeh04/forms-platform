/**
 * The actions of the instructor page: who the link is, its data and its
 * reviews.
 */

var API = API || {};

API['viewer.me'] = function (req) {
  var client = requireClient_(req);
  return {
    client: { name: client.name, canReview: client.canReview },
    forms: viewerForms_(client).map(function (f) {
      return Object.assign(viewFormMetadata_(f), { icon: f.icon });
    })
  };
};

API['viewer.data'] = function (req) {
  var client = requireClient_(req);
  var form = requireClientForm_(client, req.slug);
  var vform = validationForm(form);
  var kind = viewKind_(form);
  var mode = req.mode === 'today' || req.mode === 'day' ? req.mode : 'all';
  var out = {
    form: viewFormMetadata_(form),
    kind: kind,
    columns: visibleColumns_(client, form),
    canReview: client.canReview,
    steps: (form.review && form.review.steps) || [],
    generatedAt: nowIso()
  };
  if (kind === 'reservation') {
    out.today = todayIso_();
    out.days = ((form.slots && form.slots.days) || []).map(function (d) {
      return { id: d.id, label: d.label, date: d.date };
    });
    out.rows = reservationRows_(vform, client, mode, String(req.dayId || ''));
  } else if (kind === 'team') {
    out.groups = teamGroups_(vform, client);
    out.sizeAlerts = viewerSizeAlerts_(form, client);
  } else {
    out.rows = whatsappRows_(vform, client);
  }
  return out;
};

API['viewer.review'] = function (req) {
  var client = requireClient_(req);
  var form = requireClientForm_(client, req.slug);
  if (!client.canReview) fail('forbidden', 'This link is read-only.');
  withLock_(function () {
    var r = readResponses(form).filter(function (x) {
      return x.id === req.submissionId;
    })[0];
    if (!r) fail('submission_not_found', 'That submission does not exist.');
    setReviewStep_(form, r, String(req.stepId), String(req.status));
    saveResponse_(form, r);
  });
  afterChange_(form);
  return { updated: true };
};
