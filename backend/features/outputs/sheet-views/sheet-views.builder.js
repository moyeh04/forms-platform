/**
 * Styled views inside each form's own spreadsheet: the team list, the bookings
 * and the registrations. Every team (or day, or registration) is a block with
 * its own tint and a heavy border around it, so the eye can match a name to its
 * task, code or slot at a glance.
 */

var SheetViewsBuilder = (function () {
function byCreated_(a, b) {
  return a.created < b.created ? -1 : a.created > b.created ? 1 : 0;
}

function buildTeamList_(form, ss) {
  var sh = SheetViewsLayout.freshView(ss, 'Team Members List');
  SheetViewsLayout.paintHeader(sh, ['Team member name', 'Section', 'Code', TeamsService.teamThing(form)]);
  sh.setColumnWidth(1, 300);
  sh.setColumnWidth(2, 100);
  sh.setColumnWidth(3, 110);
  sh.setColumnWidth(4, 280);

  var teams = TeamsService.teamBlocks(form);
  if (!teams.length) return SheetViewsLayout.emptyView(sh, 4, 'No registrations yet.');

  var values = [],
    shades = [],
    blocks = [];
  teams.forEach(function (t, g) {
    var style = SheetViewsLayout.VIEW_STYLE.groups[g % 2];
    var start = values.length + 2;
    t.members.forEach(function (m, i) {
      values.push([
        i + 1 + '.  ' + m.name + (m.leader ? '  \u2605' : ''),
        m.section || '',
        m.code,
        ''
      ]);
      shades.push([
        style.shades[i % 2],
        style.shades[i % 2],
        style.shades[i % 2],
        style.solid
      ]);
    });
    blocks.push({
      start: start,
      length: t.members.length,
      response: t.response,
      style: style
    });
  });

  var first = 2,
    last = values.length + 1;
  sh.getRange(first, 1, values.length, 4)
    .setValues(values)
    .setBackgrounds(shades)
    .setFontFamily(SheetViewsLayout.VIEW_STYLE.font)
    .setFontSize(11)
    .setVerticalAlignment('middle');
  sh.getRange(first, 1, values.length, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('left');
  sh.getRange(first, 2, values.length, 2)
    .setHorizontalAlignment('center')
    .setFontWeight('bold');
  sh.setRowHeights(first, values.length, 32);

  blocks.forEach(function (b) {
    var title = b.response.title || '\u2014';
    SheetViewsLayout.mergedLabel(
      sh,
      b.start,
      4,
      b.length,
      title,
      b.response.link ? SheetViewsLayout.hyperlink(b.response.link, title) : '',
      b.style.solid
    );
  });
  SheetViewsLayout.frameBlocks(sh, 4, first, last, blocks);
}

function buildBookings_(form, ss) {
  var sh = SheetViewsLayout.freshView(ss, 'Bookings');
  var membersField = Rules.fieldByRole(form, 'members');
  var includeMembers = !!(membersField && membersField.enabled !== false);
  var headers = ['Day', 'Time', 'Team leader', 'Code', 'Phone', 'Project'];
  if (includeMembers) headers.push('Teammates');
  SheetViewsLayout.paintHeader(sh, headers);
  [190, 140, 300, 110, 130, 280]
    .concat(includeMembers ? [240] : [])
    .forEach(function (w, i) {
      sh.setColumnWidth(i + 1, w);
    });

  var days = (form.slots && form.slots.days) || [];
  function order(r) {
    var p = SlotsRules.slotParts(form, r.slot);
    var di = days.indexOf(p.day);
    var ti = p.day ? p.day.times.indexOf(p.time) : 0;
    return (di < 0 ? 999 : di) * 1000 + (ti < 0 ? 999 : ti);
  }
  var rows = ResponsesRepository.readResponses(form)
    .filter(function (r) {
      return r.slot;
    })
    .sort(function (a, b) {
      return order(a) - order(b);
    });
  if (!rows.length) return SheetViewsLayout.emptyView(sh, 6, 'No bookings yet.');

  var values = [],
    shades = [],
    blocks = [],
    current = null;
  rows.forEach(function (r) {
    var p = SlotsRules.slotParts(form, r.slot);
    if (!current || current.dayId !== p.dayId) {
      var g = blocks.length;
      current = {
        dayId: p.dayId,
        label: p.day ? p.day.label : p.dayId,
        start: values.length + 2,
        length: 0,
        style: SheetViewsLayout.VIEW_STYLE.groups[g % 2]
      };
      blocks.push(current);
    }
    var i = current.length++;
    var row = ['', p.time, r.name, r.code, r.phone, r.title];
    if (includeMembers)
      row.push(
        (r.data.members || [])
          .map(function (member) {
            return member.name;
          })
          .filter(Boolean)
          .join(', ')
      );
    values.push(row);
    var s = current.style.shades[i % 2];
    shades.push(
      [current.style.solid, s, s, s, s, s].concat(includeMembers ? [s] : [])
    );
  });

  sh.getRange(2, 1, values.length, headers.length)
    .setValues(values)
    .setBackgrounds(shades)
    .setFontFamily(SheetViewsLayout.VIEW_STYLE.font)
    .setFontSize(11)
    .setVerticalAlignment('middle');
  sh.getRange(2, 3, values.length, 1).setFontWeight('bold');
  sh.getRange(2, 2, values.length, 1).setHorizontalAlignment('center');
  sh.getRange(2, 4, values.length, 2).setHorizontalAlignment('center');
  sh.setRowHeights(2, values.length, 32);
  blocks.forEach(function (b) {
    SheetViewsLayout.mergedLabel(sh, b.start, 1, b.length, b.label, '', b.style.solid);
  });
  SheetViewsLayout.frameBlocks(sh, 6, 2, values.length + 1, blocks);
}

function reviewText_(form, r) {
  return ((form.review && form.review.steps) || [])
    .map(function (s) {
      return s.label.en + ': ' + (r.review[s.id] || 'pending');
    })
    .join('  |  ');
}

function buildRegistrations_(form, ss) {
  var sh = SheetViewsLayout.freshView(ss, 'Registrations');
  SheetViewsLayout.paintHeader(sh, [
    'No.',
    'Name',
    'Code',
    'Phone',
    'Group',
    'Section',
    'Timetable',
    'Review'
  ]);
  [60, 300, 110, 130, 80, 90, 120, 320].forEach(function (w, i) {
    sh.setColumnWidth(i + 1, w);
  });

  var rows = ResponsesRepository.readResponses(form).sort(function (a, b) {
    var ga = String(a.data.group),
      gb = String(b.data.group);
    if (ga !== gb) return ga < gb ? -1 : 1;
    return (
      (parseInt(a.data.section, 10) || 0) -
        (parseInt(b.data.section, 10) || 0) || byCreated_(a, b)
    );
  });
  if (!rows.length) return SheetViewsLayout.emptyView(sh, 8, 'No registrations yet.');

  var values = [],
    shades = [];
  rows.forEach(function (r, i) {
    values.push([
      i + 1,
      r.name,
      r.code,
      r.phone,
      r.data.group || '',
      r.data.section || '',
      '',
      reviewText_(form, r)
    ]);
    var s = SheetViewsLayout.VIEW_STYLE.groups[i % 2].shades[0];
    shades.push([s, s, s, s, s, s, s, s]);
  });
  sh.getRange(2, 1, values.length, 8)
    .setValues(values)
    .setBackgrounds(shades)
    .setFontFamily(SheetViewsLayout.VIEW_STYLE.font)
    .setFontSize(11)
    .setVerticalAlignment('middle');
  rows.forEach(function (r, i) {
    if (r.link) sh.getRange(i + 2, 7).setFormula(SheetViewsLayout.hyperlink(r.link, 'Open'));
  });
  sh.getRange(2, 2, values.length, 1).setFontWeight('bold');
  sh.setRowHeights(2, values.length, 30);
  SheetViewsLayout.frameBlocks(sh, 8, 2, values.length + 1, []);
}

var VIEW_BUILDERS_ = {
  team_registration: buildTeamList_,
  task_submission: buildTeamList_,
  reservation: buildBookings_,
  whatsapp_registration: buildRegistrations_
};

return { byCreated: byCreated_, VIEW_BUILDERS: VIEW_BUILDERS_ };
})();
