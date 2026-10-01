/**
 * WhatsApp matching. WhatsApp has no free way to read pending join requests,
 * so a reviewer pastes the numbers and the platform matches them, by
 * normalized phone, to what each student submitted.
 */

var API = API || {};

var REQUEST_COLS_ = ['id', 'raw', 'phone', 'label', 'added', 'decision', 'note'];

function requestsSheet_(form) {
  return ensureTab(SpreadsheetApp.openById(form.sheetId), 'Requests', REQUEST_COLS_);
}

function readRequests_(form) {
  return readTable(requestsSheet_(form), REQUEST_COLS_).map(function (r) {
    return { _row: r._row, id: String(r.id), raw: String(r.raw), phone: String(r.phone), label: String(r.label), added: String(r.added), decision: String(r.decision || 'pending'), note: String(r.note) };
  });
}

function requireMatching_(form) {
  if (!form.matching || !form.matching.enabled) fail('no_matching', 'Matching is not turned on for this form.');
}

API['admin.matching.import'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  requireMatching_(form);
  return withLock_(function () {
    var sh = requestsSheet_(form);
    var have = {};
    readRequests_(form).forEach(function (r) { have[r.phone] = true; });
    var added = 0, duplicates = 0, unparsed = [];
    String(req.text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var phones = Rules.extractPhones(line);
      if (!phones.length) { unparsed.push(line); return; }
      phones.forEach(function (p) {
        if (have[p.phone]) { duplicates++; return; }
        have[p.phone] = true;
        var label = line.split(p.raw).join(' ').replace(/[\s,;:|\-]+/g, ' ').trim();
        sh.appendRow([uuid(), line, p.phone, label, nowIso(), 'pending', '']);
        added++;
      });
    });
    return { added: added, duplicates: duplicates, unparsed: unparsed };
  });
});

API['admin.matching.list'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  requireMatching_(form);
  var subs = readResponses(form);
  var byPhone = {};
  subs.forEach(function (r) {
    var p = Rules.normalizePhone(r.phone);
    if (p) (byPhone[p] = byPhone[p] || []).push(r.id);
  });
  var requests = readRequests_(form);
  var requested = {};
  var out = requests.map(function (q) {
    requested[q.phone] = true;
    var ids = byPhone[q.phone] || [];
    return { id: q.id, phone: q.phone, label: q.label, added: q.added, decision: q.decision, note: q.note, matches: ids, status: ids.length === 0 ? 'none' : ids.length === 1 ? 'matched' : 'duplicate' };
  });
  var notRequested = subs.filter(function (r) { return !requested[Rules.normalizePhone(r.phone)]; }).map(function (r) { return r.id; });
  return { requests: out, submissions: subs.map(adminView_), notRequested: notRequested };
});

API['admin.matching.decide'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  requireMatching_(form);
  var decision = String(req.decision);
  if (REVIEW_STATUSES.indexOf(decision) === -1) fail('bad_status', 'Decision must be pending, approved, or rejected.');
  var stepId = form.matching.step || 'group';
  var hasStep = ((form.review && form.review.steps) || []).some(function (s) { return s.id === stepId; });
  var linked = null;
  withLock_(function () {
    var q = readRequests_(form).filter(function (x) { return x.id === req.requestId; })[0];
    if (!q) fail('request_not_found', 'That request does not exist.');
    var subs = readResponses(form).filter(function (r) { return Rules.normalizePhone(r.phone) === q.phone; });
    if (hasStep && subs.length === 1) {
      setReviewStep_(form, subs[0], stepId, decision);
      saveResponse_(form, subs[0]);
      linked = subs[0].id;
    }
    var sh = requestsSheet_(form);
    q.decision = decision;
    if (req.note !== undefined) q.note = String(req.note);
    writeRow(sh, q._row, REQUEST_COLS_, q);
  });
  if (linked) afterChange_(form);
  return { decided: true, submissionId: linked };
});

API['admin.matching.remove'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  requireMatching_(form);
  var ids = {};
  (req.requestIds || []).forEach(function (i) { ids[i] = true; });
  var removed = 0;
  withLock_(function () {
    var sh = requestsSheet_(form);
    readRequests_(form).filter(function (q) { return ids[q.id]; }).sort(function (a, b) { return b._row - a._row; })
      .forEach(function (q) { sh.deleteRow(q._row); removed++; });
  });
  return { removed: removed };
});
