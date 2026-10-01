/** What an instructor or client sees through a private link. Read-only. */

var API = API || {};

var VIEW_COLUMNS_ = {
  reservation: [['time', 'Time'], ['name', 'Team leader'], ['code', 'Code'], ['phone', 'Phone'], ['email', 'Email'], ['title', 'Project'], ['level', 'Level'], ['section', 'Section']],
  team: [['name', 'Name'], ['code', 'Code'], ['phone', 'Phone'], ['title', 'Project or task'], ['link', 'Link']],
  whatsapp: [['name', 'Name'], ['code', 'Code'], ['phone', 'Phone'], ['level', 'Level'], ['group', 'Group'], ['section', 'Section'], ['link', 'Timetable'], ['review', 'Review']]
};

function viewKind_(form) {
  return form.type === 'reservation' ? 'reservation' : form.type === 'whatsapp_registration' ? 'whatsapp' : 'team';
}

function visibleColumns_(client, form) {
  return VIEW_COLUMNS_[viewKind_(form)].filter(function (c) { return client.hiddenColumns.indexOf(c[0]) === -1; })
    .map(function (c) { return { id: c[0], label: c[1] }; });
}

function viewerForms_(client) {
  return readForms().filter(function (f) {
    return f.status !== 'draft' && f.status !== 'archived' && clientAllows_(client, f);
  });
}

function requireClientForm_(client, slug) {
  var form = requireForm(String(slug || ''));
  if (!clientAllows_(client, form) || form.status === 'draft' || form.status === 'archived') fail('forbidden', 'You do not have access to this form.');
  return form;
}

function todayIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function stripHidden_(obj, hidden) {
  hidden.forEach(function (k) { delete obj[k]; });
  return obj;
}

function reservationRows_(form, client, mode, dayId) {
  var days = (form.slots && form.slots.days) || [];
  var today = todayIso_();
  var rows = readResponses(form).filter(function (r) { return r.slot; }).map(function (r) {
    var p = slotParts_(form, r.slot);
    var di = days.indexOf(p.day);
    return {
      _order: (di < 0 ? 999 : di) * 1000 + (p.day ? p.day.times.indexOf(p.time) : 0),
      id: r.id, dayId: p.dayId, dayLabel: p.day ? p.day.label : p.dayId, date: p.day ? p.day.date : '',
      time: p.time, name: r.name, code: r.code, phone: r.phone, email: r.email, title: r.title,
      level: r.data.level || '', section: r.data.section || ''
    };
  });
  if (mode === 'today') rows = rows.filter(function (r) { return r.date && r.date === today; });
  if (mode === 'day') rows = rows.filter(function (r) { return r.dayId === dayId; });
  rows.sort(function (a, b) { return a._order - b._order; });
  return rows.map(function (r) {
    delete r._order;
    return stripHidden_(r, client.hiddenColumns);
  });
}

function teamGroups_(form, client) {
  return readResponses(form).sort(byCreated_).map(function (r) {
    var g = { id: r.id, ref: r.ref, status: r.status, title: r.title, link: r.link, members: Rules.membersOf(form, r.data) };
    var hidden = client.hiddenColumns;
    if (hidden.indexOf('title') !== -1) delete g.title;
    if (hidden.indexOf('link') !== -1) delete g.link;
    g.members = g.members.map(function (m) { return stripHidden_({ name: m.name, code: m.code, phone: m.phone, leader: m.leader }, ['name', 'code', 'phone'].filter(function (k) { return hidden.indexOf(k) !== -1; })); });
    return g;
  });
}

function whatsappRows_(form, client) {
  return readResponses(form).sort(byCreated_).map(function (r) {
    return stripHidden_({
      id: r.id, name: r.name, code: r.code, phone: r.phone, level: r.data.level || '', group: r.data.group || '',
      section: r.data.section || '', link: r.link, review: r.review, status: r.status
    }, client.hiddenColumns);
  });
}

API['viewer.me'] = function (req) {
  var client = requireClient_(req);
  return {
    client: { name: client.name, canReview: client.canReview },
    forms: viewerForms_(client).map(function (f) {
      return { slug: f.slug, title: f.title, term: f.term, subject: f.subject || '', type: f.type, icon: f.icon };
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
    form: { slug: form.slug, title: form.title, term: form.term, subject: form.subject || '', type: form.type },
    kind: kind, columns: visibleColumns_(client, form), canReview: client.canReview,
    steps: (form.review && form.review.steps) || [], generatedAt: nowIso()
  };
  if (kind === 'reservation') {
    out.today = todayIso_();
    out.days = ((form.slots && form.slots.days) || []).map(function (d) { return { id: d.id, label: d.label, date: d.date }; });
    out.rows = reservationRows_(vform, client, mode, String(req.dayId || ''));
  } else if (kind === 'team') {
    out.groups = teamGroups_(vform, client);
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
    var r = readResponses(form).filter(function (x) { return x.id === req.submissionId; })[0];
    if (!r) fail('submission_not_found', 'That submission does not exist.');
    setReviewStep_(form, r, String(req.stepId), String(req.status));
    saveResponse_(form, r);
  });
  afterChange_(form);
  return { updated: true };
};
