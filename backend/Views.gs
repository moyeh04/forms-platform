/**
 * Styled views inside each form's own spreadsheet.
 *
 * Every team (or day, or registration) is a block with its own tint and a
 * heavy border around it, so the eye can match a name to its task, code or
 * slot at a glance.
 *
 * A change only marks the form's views as out of date and books one run a minute later. The
 * run repaints every marked form and removes itself, so students never wait for formatting
 * and nothing runs while nothing changes.
 */

var API = API || {};

var VIEW_DELAY_MS_ = 60000;
/** A run stops starting new forms after this long, well inside Google's six minutes, and books another. */
var VIEW_RUN_BUDGET_MS_ = 240000;

var VIEW_STYLE_ = {
  ink: '#3A2A1A',
  onInk: '#F3E6C4',
  grid: '#C9B58A',
  font: 'Arial',
  groups: [
    { shades: ['#DCEAE4', '#EEF5F1'], solid: '#3F6B66' },
    { shades: ['#F0E4C6', '#F8F1DE'], solid: '#8E2B22' }
  ]
};

function freshView_(ss, name) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  return sh;
}

function paintHeader_(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(VIEW_STYLE_.ink).setFontColor(VIEW_STYLE_.onInk).setFontWeight('bold')
    .setFontSize(12).setFontFamily(VIEW_STYLE_.font)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 40);
  sh.setFrozenRows(1);
}

function emptyView_(sh, cols, text) {
  sh.getRange(2, 1, 1, cols).merge().setValue(text).setHorizontalAlignment('center').setFontColor('#6B5535').setFontFamily(VIEW_STYLE_.font);
}

/** Thin grid inside, heavy frame around each block. */
function frameBlocks_(sh, cols, firstRow, lastRow, blocks) {
  sh.getRange(firstRow, 1, lastRow - firstRow + 1, cols).setBorder(true, true, true, true, true, true, VIEW_STYLE_.grid, SpreadsheetApp.BorderStyle.SOLID);
  blocks.forEach(function (b) {
    sh.getRange(b.start, 1, b.length, cols).setBorder(true, true, true, true, false, false, VIEW_STYLE_.ink, SpreadsheetApp.BorderStyle.SOLID_THICK);
  });
}

function mergedLabel_(sh, row, col, length, value, formula, solid) {
  var r = sh.getRange(row, col, length, 1);
  if (length > 1) r.merge();
  var anchor = sh.getRange(row, col);
  if (formula) anchor.setFormula(formula); else anchor.setValue(value);
  r.setBackground(solid).setFontColor(VIEW_STYLE_.onInk).setFontWeight('bold').setFontSize(13).setFontFamily(VIEW_STYLE_.font)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
}

function hyperlink_(url, text) {
  return '=HYPERLINK("' + String(url).replace(/"/g, '""') + '","' + String(text).replace(/"/g, '""') + '")';
}

function byCreated_(a, b) {
  return a.created < b.created ? -1 : a.created > b.created ? 1 : 0;
}

/* ── Team Members List: teams, projects and tasks ─────────────── */

function buildTeamList_(form, ss) {
  var sh = freshView_(ss, 'Team Members List');
  paintHeader_(sh, ['Team member name', 'Section', 'Code', teamThing_(form)]);
  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 100); sh.setColumnWidth(3, 110); sh.setColumnWidth(4, 280);

  var teams = teamBlocks_(form);
  if (!teams.length) return emptyView_(sh, 4, 'No registrations yet.');

  var values = [], shades = [], blocks = [];
  teams.forEach(function (t, g) {
    var style = VIEW_STYLE_.groups[g % 2];
    var start = values.length + 2;
    t.members.forEach(function (m, i) {
      values.push([(i + 1) + '.  ' + m.name + (m.leader ? '  \u2605' : ''), m.section || '', m.code, '']);
      shades.push([style.shades[i % 2], style.shades[i % 2], style.shades[i % 2], style.solid]);
    });
    blocks.push({ start: start, length: t.members.length, response: t.response, style: style });
  });

  var first = 2, last = values.length + 1;
  sh.getRange(first, 1, values.length, 4).setValues(values).setBackgrounds(shades)
    .setFontFamily(VIEW_STYLE_.font).setFontSize(11).setVerticalAlignment('middle');
  sh.getRange(first, 1, values.length, 1).setFontWeight('bold').setHorizontalAlignment('left');
  sh.getRange(first, 2, values.length, 2).setHorizontalAlignment('center').setFontWeight('bold');
  sh.setRowHeights(first, values.length, 32);

  blocks.forEach(function (b) {
    var title = b.response.title || '\u2014';
    mergedLabel_(sh, b.start, 4, b.length, title, b.response.link ? hyperlink_(b.response.link, title) : '', b.style.solid);
  });
  frameBlocks_(sh, 4, first, last, blocks);
}

/* ── Bookings: one block per day ──────────────────────────────── */

function buildBookings_(form, ss) {
  var sh = freshView_(ss, 'Bookings');
  var membersField = Rules.fieldByRole(form, 'members');
  var includeMembers = !!(membersField && membersField.enabled !== false);
  var headers = ['Day', 'Time', 'Team leader', 'Code', 'Phone', 'Project'];
  if (includeMembers) headers.push('Teammates');
  paintHeader_(sh, headers);
  [190, 140, 300, 110, 130, 280].concat(includeMembers ? [240] : []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var days = (form.slots && form.slots.days) || [];
  function order(r) {
    var p = slotParts_(form, r.slot);
    var di = days.indexOf(p.day);
    var ti = p.day ? p.day.times.indexOf(p.time) : 0;
    return (di < 0 ? 999 : di) * 1000 + (ti < 0 ? 999 : ti);
  }
  var rows = readResponses(form).filter(function (r) { return r.slot; }).sort(function (a, b) { return order(a) - order(b); });
  if (!rows.length) return emptyView_(sh, 6, 'No bookings yet.');

  var values = [], shades = [], blocks = [], current = null;
  rows.forEach(function (r) {
    var p = slotParts_(form, r.slot);
    if (!current || current.dayId !== p.dayId) {
      var g = blocks.length;
      current = { dayId: p.dayId, label: p.day ? p.day.label : p.dayId, start: values.length + 2, length: 0, style: VIEW_STYLE_.groups[g % 2] };
      blocks.push(current);
    }
    var i = current.length++;
    var row = ['', p.time, r.name, r.code, r.phone, r.title];
    if (includeMembers) row.push((r.data.members || []).map(function (member) { return member.name; }).filter(Boolean).join(', '));
    values.push(row);
    var s = current.style.shades[i % 2];
    shades.push([current.style.solid, s, s, s, s, s].concat(includeMembers ? [s] : []));
  });

  sh.getRange(2, 1, values.length, headers.length).setValues(values).setBackgrounds(shades)
    .setFontFamily(VIEW_STYLE_.font).setFontSize(11).setVerticalAlignment('middle');
  sh.getRange(2, 3, values.length, 1).setFontWeight('bold');
  sh.getRange(2, 2, values.length, 1).setHorizontalAlignment('center');
  sh.getRange(2, 4, values.length, 2).setHorizontalAlignment('center');
  sh.setRowHeights(2, values.length, 32);
  blocks.forEach(function (b) { mergedLabel_(sh, b.start, 1, b.length, b.label, '', b.style.solid); });
  frameBlocks_(sh, 6, 2, values.length + 1, blocks);
}

/* ── Registrations: WhatsApp requests ─────────────────────────── */

function reviewText_(form, r) {
  return ((form.review && form.review.steps) || []).map(function (s) {
    return s.label.en + ': ' + (r.review[s.id] || 'pending');
  }).join('  |  ');
}

function buildRegistrations_(form, ss) {
  var sh = freshView_(ss, 'Registrations');
  paintHeader_(sh, ['No.', 'Name', 'Code', 'Phone', 'Group', 'Section', 'Timetable', 'Review']);
  [60, 300, 110, 130, 80, 90, 120, 320].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var rows = readResponses(form).sort(function (a, b) {
    var ga = String(a.data.group), gb = String(b.data.group);
    if (ga !== gb) return ga < gb ? -1 : 1;
    return (parseInt(a.data.section, 10) || 0) - (parseInt(b.data.section, 10) || 0) || byCreated_(a, b);
  });
  if (!rows.length) return emptyView_(sh, 8, 'No registrations yet.');

  var values = [], shades = [];
  rows.forEach(function (r, i) {
    values.push([i + 1, r.name, r.code, r.phone, r.data.group || '', r.data.section || '', '', reviewText_(form, r)]);
    var s = VIEW_STYLE_.groups[i % 2].shades[0];
    shades.push([s, s, s, s, s, s, s, s]);
  });
  sh.getRange(2, 1, values.length, 8).setValues(values).setBackgrounds(shades)
    .setFontFamily(VIEW_STYLE_.font).setFontSize(11).setVerticalAlignment('middle');
  rows.forEach(function (r, i) {
    if (r.link) sh.getRange(i + 2, 7).setFormula(hyperlink_(r.link, 'Open'));
  });
  sh.getRange(2, 2, values.length, 1).setFontWeight('bold');
  sh.setRowHeights(2, values.length, 30);
  frameBlocks_(sh, 8, 2, values.length + 1, []);
}

/* ── Orchestration ────────────────────────────────────────────── */

var VIEW_BUILDERS_ = {
  team_registration: buildTeamList_,
  task_submission: buildTeamList_,
  reservation: buildBookings_,
  whatsapp_registration: buildRegistrations_
};

/** Paints the views now. It only reads the responses and writes its own tabs, so it takes no lock. */
function rebuildViews(form) {
  var build = VIEW_BUILDERS_[form.type];
  if (!build) return false;
  build(validationForm(form), SpreadsheetApp.openById(form.sheetId));
  return true;
}

/** Marks a form's views as out of date, with the time, and makes sure a run is booked. */
function refreshViews(form) {
  setProp('dirty:' + form.id, nowIso());
  bookViewRun_();
}

function viewRunBooked_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'processDirtyViews'; });
}

/** Books one run of processDirtyViews. The cache note saves looking at the triggers on every change. */
function bookViewRun_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('views_booked')) return;
  withLock_(function () {
    if (!viewRunBooked_()) ScriptApp.newTrigger('processDirtyViews').timeBased().after(VIEW_DELAY_MS_).create();
  });
  cache.put('views_booked', '1', 300);
}

/**
 * The booked run: removes its trigger, repaints every marked form, and books another run only
 * when a change arrived while it was painting or it ran out of time. A form whose repaint fails
 * keeps its mark, so the next change, or Rebuild sheet in the dashboard, paints it.
 */
function processDirtyViews() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processDirtyViews') ScriptApp.deleteTrigger(t);
  });
  CacheService.getScriptCache().remove('views_booked');
  var store = PropertiesService.getScriptProperties();
  var marks = store.getProperties();
  var forms = {};
  readForms().forEach(function (f) { forms[f.id] = f; });
  var started = Date.now(), again = false;
  Object.keys(marks).forEach(function (k) {
    if (k.indexOf('dirty:') !== 0) return;
    var form = forms[k.slice(6)];
    if (!form) { store.deleteProperty(k); return; }
    if (Date.now() - started > VIEW_RUN_BUDGET_MS_) { again = true; return; }
    try {
      rebuildViews(form);
    } catch (e) {
      Logger.log('Views of ' + form.slug + ' not rebuilt: ' + e.message);
      return;
    }
    if (store.getProperty(k) === marks[k]) store.deleteProperty(k);
    else again = true;
  });
  if (again) bookViewRun_();
}

API['admin.views.rebuild'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  rebuildViews(form);
  return { rebuilt: true, sheetUrl: form.sheetUrl };
});
