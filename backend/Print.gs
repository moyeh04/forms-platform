/**
 * Print-ready tabs and PDF export.
 * The tabs are rebuilt on demand, so they always show the latest data.
 */

var API = API || {};

function printSheetName_(label) {
  return ('Print - ' + String(label).replace(/[\[\]*?:\/\\]/g, '-')).slice(0, 90);
}

function sheetLink_(form, gid) {
  return 'https://docs.google.com/spreadsheets/d/' + form.sheetId + '/edit#gid=' + gid;
}

function paintPrintHeader_(sh, title, headers) {
  var cols = headers.length;
  sh.getRange(1, 1, 1, cols).merge().setValue(title).setFontFamily(VIEW_STYLE_.font).setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);
  sh.getRange(3, 1, 1, cols).setValues([headers]).setFontFamily(VIEW_STYLE_.font).setFontSize(12).setFontWeight('bold')
    .setBackground('#E9DFC4').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(3, 34);
}

/** One day of reservations, in timetable order, with a signature column. */
function printReservations_(form, dayId, includeEmpty) {
  var vform = validationForm(form);
  var days = (vform.slots && vform.slots.days) || [];
  var day = days.filter(function (d) { return d.id === dayId; })[0];
  if (!day) fail('day_not_found', 'That day is not in the timetable.');

  var byTime = {};
  readResponses(form).forEach(function (r) {
    var p = slotParts_(vform, r.slot);
    if (p.dayId !== dayId) return;
    (byTime[p.time] = byTime[p.time] || []).push(r);
  });

  var includeMembers = Rules.fieldByRole(vform, 'members').enabled !== false;
  var values = [];
  day.times.forEach(function (t) {
    var list = byTime[t] || [];
    if (!list.length && includeEmpty) values.push(includeMembers ? ['', t, '', '', '', '', ''] : ['', t, '', '', '', '']);
    list.forEach(function (r) {
      var row = ['', t, r.name, r.code, r.title];
      if (includeMembers) row.push((r.data.members || []).map(function (m) { return m.name; }).filter(Boolean).join(', '));
      row.push('');
      values.push(row);
    });
  });
  values.forEach(function (v, i) { v[0] = i + 1; });

  var ss = SpreadsheetApp.openById(form.sheetId);
  var sh = freshView_(ss, printSheetName_(day.label));
  var headers = ['No.', 'Time', 'Team leader', 'Code', 'Project'];
  if (includeMembers) headers.push('Teammates');
  headers.push('Signature');
  paintPrintHeader_(sh, form.title + '  -  ' + day.label + (day.date ? '  (' + day.date + ')' : ''), headers);
  [60, 150, 300, 110, 260].concat(includeMembers ? [240, 160] : [160]).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  if (values.length) {
    sh.getRange(4, 1, values.length, headers.length).setValues(values).setFontFamily(VIEW_STYLE_.font).setFontSize(12).setVerticalAlignment('middle');
    sh.getRange(4, 1, values.length, 2).setHorizontalAlignment('center');
    sh.getRange(4, 4, values.length, 1).setHorizontalAlignment('center');
    sh.setRowHeights(4, values.length, 38);
    sh.getRange(3, 1, values.length + 1, headers.length).setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  } else {
    sh.getRange(4, 1, 1, headers.length).merge().setValue('No bookings for this day.').setHorizontalAlignment('center');
  }
  return { sheetName: sh.getName(), gid: sh.getSheetId(), count: values.length, landscape: false };
}

/** Everyone, team by team, with the team number and task merged. */
function printTeamList_(form) {
  var vform = validationForm(form);
  var third = form.type === 'task_submission' ? 'Task' : 'Project';
  var ss = SpreadsheetApp.openById(form.sheetId);
  var sh = freshView_(ss, 'Print - Team list');
  var headers = ['Team', 'Team member name', 'Code', third];
  var metadata = FormMetadata.caption(vform);
  paintPrintHeader_(sh, vform.title + (metadata ? '  -  ' + metadata : '') + '  -  Team list', headers);
  [70, 330, 120, 300].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var responses = readResponses(form).sort(byCreated_);
  var values = [], shades = [], blocks = [];
  responses.forEach(function (r, g) {
    var style = VIEW_STYLE_.groups[g % 2];
    var members = Rules.membersOf(vform, r.data);
    var start = values.length + 4;
    members.forEach(function (m, i) {
      values.push(['', (i + 1) + '.  ' + m.name + (m.leader ? '  \u2605' : ''), m.code, '']);
      shades.push([style.shades[0], style.shades[i % 2], style.shades[i % 2], style.shades[0]]);
    });
    blocks.push({ start: start, length: members.length, number: g + 1, response: r });
  });
  if (!values.length) {
    sh.getRange(4, 1, 1, 4).merge().setValue('No registrations yet.').setHorizontalAlignment('center');
    return { sheetName: sh.getName(), gid: sh.getSheetId(), count: 0, landscape: false };
  }
  sh.getRange(4, 1, values.length, 4).setValues(values).setBackgrounds(shades).setFontFamily(VIEW_STYLE_.font).setFontSize(12).setVerticalAlignment('middle');
  sh.getRange(4, 2, values.length, 1).setFontWeight('bold');
  sh.getRange(4, 3, values.length, 1).setHorizontalAlignment('center');
  sh.setRowHeights(4, values.length, 30);
  blocks.forEach(function (b) {
    var title = b.response.title || '\u2014';
    mergedLabel_(sh, b.start, 1, b.length, b.number, '', '#E9DFC4');
    sh.getRange(b.start, 1).setFontColor('#000000');
    mergedLabel_(sh, b.start, 4, b.length, title, b.response.link ? hyperlink_(b.response.link, title) : '', '#E9DFC4');
    sh.getRange(b.start, 4).setFontColor('#000000');
  });
  frameBlocks_(sh, 4, 4, values.length + 3, blocks);
  sh.getRange(3, 1, 1, 4).setBorder(true, true, true, true, true, true, VIEW_STYLE_.ink, SpreadsheetApp.BorderStyle.SOLID);
  return { sheetName: sh.getName(), gid: sh.getSheetId(), count: blocks.length, landscape: false };
}

function exportsFolder_() {
  var root = rootFolder();
  var it = root.getFoldersByName('Exports');
  return it.hasNext() ? it.next() : root.createFolder('Exports');
}

/** Saves the tab as a PDF in Drive. Returns its link, or null when Google refuses. */
function exportPdf_(form, printed) {
  try {
    var url = 'https://docs.google.com/spreadsheets/d/' + form.sheetId + '/export?format=pdf&gid=' + printed.gid +
      '&size=A4&portrait=' + (printed.landscape ? 'false' : 'true') +
      '&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenumbers=true&attachment=false';
    var resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) return null;
    var blob = resp.getBlob().setName(printed.sheetName.replace(/^Print - /, '') + '.pdf');
    return exportsFolder_().createFile(blob).getUrl();
  } catch (e) {
    Logger.log('PDF export failed: ' + e.message);
    return null;
  }
}

function printResult_(form, printed) {
  return { count: printed.count, sheetName: printed.sheetName, sheetUrl: sheetLink_(form, printed.gid), pdfUrl: exportPdf_(form, printed) };
}

API['admin.print.reservations'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (form.type !== 'reservation') fail('wrong_type', 'Only reservation forms have days to print.');
  return printResult_(form, printReservations_(form, String(req.dayId || ''), !!req.includeEmpty));
});

API['admin.print.teamList'] = admin(function (req) {
  var form = requireForm(req.slug || req.id);
  if (form.type !== 'team_registration' && form.type !== 'task_submission') fail('wrong_type', 'Only team and task forms have a team list.');
  return printResult_(form, printTeamList_(form));
});
