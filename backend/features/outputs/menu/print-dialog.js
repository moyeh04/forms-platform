/** The dialog the print menu items open in the sheet. */

/** The forms (and their days) a print dialog can offer. */
function menuPrintOptions(kind) {
  var types =
    kind === 'reservations'
      ? ['reservation']
      : ['team_registration', 'task_submission'];
  return readForms()
    .filter(function (f) {
      return types.indexOf(f.type) !== -1;
    })
    .map(function (f) {
      return {
        slug: f.slug,
        label:
          f.title +
          (FormMetadata.caption(f) ? ' (' + FormMetadata.caption(f) + ')' : ''),
        days: ((f.slots && f.slots.days) || []).map(function (d) {
          return { id: d.id, label: d.label };
        })
      };
    });
}

function printDialogHtml_(kind) {
  var forms = menuPrintOptions(kind);
  var formOpts = forms
    .map(function (f, i) {
      return '<option value="' + i + '">' + esc_(f.label) + '</option>';
    })
    .join('');
  var needsDay = kind === 'reservations';
  return (
    '<style>body{font-family:Arial,sans-serif;padding:8px;font-size:14px}select,button{font-size:14px;padding:6px;margin:4px 0;width:100%}' +
    'a{display:block;margin-top:8px}</style>' +
    (forms.length ? '' : '<p>There are no matching forms yet.</p>') +
    '<label>Form</label><select id="form">' +
    formOpts +
    '</select>' +
    (needsDay
      ? '<label>Day</label><select id="day"></select><label><input type="checkbox" id="empty"> Include empty slots</label>'
      : '') +
    '<button id="go">Create printable sheet and PDF</button><div id="out"></div>' +
    '<script>var forms=' +
    JSON.stringify(forms).replace(/</g, '\\u003c') +
    ';var kind=' +
    JSON.stringify(kind) +
    ';' +
    'var f=document.getElementById("form"),d=document.getElementById("day");' +
    'function fill(){if(!d)return;var x=forms[f.value];d.innerHTML=(x?x.days:[]).map(function(a){return "<option value=\\""+a.id+"\\">"+a.label+"</option>"}).join("")}' +
    'f.onchange=fill;fill();' +
    'document.getElementById("go").onclick=function(){var x=forms[f.value];if(!x)return;var out=document.getElementById("out");out.textContent="Working...";' +
    'google.script.run.withSuccessHandler(function(r){out.innerHTML="Done ("+r.count+" rows).<a target=_blank href=\\""+r.sheetUrl+"\\">Open the sheet</a>"+(r.pdfUrl?"<a target=_blank href=\\""+r.pdfUrl+"\\">Open the PDF</a>":"<span>PDF export was not available. Use File > Print on the sheet.</span>")})' +
    '.withFailureHandler(function(e){out.textContent=e.message}).menuPrint(kind,x.slug,d?d.value:"",!!(document.getElementById("empty")&&document.getElementById("empty").checked))};</script>'
  );
}

function showPrintDialog_(kind, title) {
  var html = HtmlService.createHtmlOutput(printDialogHtml_(kind))
    .setWidth(420)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, title);
}
