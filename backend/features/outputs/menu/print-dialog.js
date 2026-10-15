/** The dialog the print menu items open in the sheet. */

var PrintDialog = (function () {
  /** The width of the dialog, in pixels. */
  var WIDTH_PX_ = 420;

  /** The height of the dialog, in pixels. */
  var HEIGHT_PX_ = 300;

  /** The style sheet of the dialog. */
  var STYLE_ = [
    '<style>',
    'body{font-family:Arial,sans-serif;padding:8px;font-size:14px}',
    'select,button{font-size:14px;padding:6px;margin:4px 0;width:100%}',
    'a{display:block;margin-top:8px}',
    '</style>'
  ].join('');

  /** The fields that pick a day, for a reservation form. */
  var DAY_FIELDS_ = [
    '<label>Day</label><select id="day"></select>',
    '<label><input type="checkbox" id="empty"> Include empty slots</label>'
  ].join('');

  /**
   * The script of the dialog, after the `forms` and `kind` it reads: it
   * fills the days of the chosen form and runs `menuPrint` on the button.
   */
  var SCRIPT_ = [
    'var f=document.getElementById("form"),d=document.getElementById("day");',
    'function fill(){if(!d)return;var x=forms[f.value];',
    'd.innerHTML=(x?x.days:[]).map(function(a){',
    'return "<option value=\\""+a.id+"\\">"+a.label+"</option>"}).join("")}',
    'f.onchange=fill;fill();',
    'document.getElementById("go").onclick=function(){',
    'var x=forms[f.value];if(!x)return;',
    'var out=document.getElementById("out");out.textContent="Working...";',
    'google.script.run.withSuccessHandler(function(r){',
    'out.innerHTML="Done ("+r.count+" rows).',
    '<a target=_blank href=\\""+r.sheetUrl+"\\">Open the sheet</a>"',
    '+(r.pdfUrl?"<a target=_blank href=\\""+r.pdfUrl+"\\">Open the PDF</a>"',
    ':"<span>PDF export was not available. ',
    'Use File > Print on the sheet.</span>")})',
    '.withFailureHandler(function(e){out.textContent=e.message})',
    '.menuPrint(kind,x.slug,d?d.value:"",',
    '!!(document.getElementById("empty")',
    '&&document.getElementById("empty").checked))};</script>'
  ].join('');

  /**
   * Lists the forms, and their days, a print dialog can offer.
   *
   * @param {string} kind `reservations` or `teams`.
   * @return {!Array<{slug: string, label: string, days: !Array<!Object>}>}
   *     The forms of that kind.
   */
  function menuPrintOptions(kind) {
    var types =
      kind === 'reservations'
        ? ['reservation']
        : ['team_registration', 'task_submission'];
    return FormsRepository.readForms()
      .filter(function (f) {
        return types.indexOf(f.type) !== -1;
      })
      .map(function (f) {
        var caption = FormMetadata.caption(f);
        return {
          slug: f.slug,
          label: f.title + (caption ? ' (' + caption + ')' : ''),
          days: (f.slots?.days || []).map(function (d) {
            return { id: d.id, label: d.label };
          })
        };
      });
  }

  /**
   * Makes the page of a print dialog.
   *
   * @param {string} kind `reservations` or `teams`.
   * @return {string} The HTML of the dialog.
   */
  function printDialogHtml_(kind) {
    var forms = menuPrintOptions(kind);
    var formOpts = forms
      .map(function (f, i) {
        return '<option value="' + i + '">' + Text.esc(f.label) + '</option>';
      })
      .join('');
    var needsDay = kind === 'reservations';
    return (
      STYLE_ +
      (forms.length ? '' : '<p>There are no matching forms yet.</p>') +
      '<label>Form</label><select id="form">' +
      formOpts +
      '</select>' +
      (needsDay ? DAY_FIELDS_ : '') +
      '<button id="go">Create printable sheet and PDF</button>' +
      '<div id="out"></div>' +
      '<script>var forms=' +
      JSON.stringify(forms).replace(/</g, '\\u003c') +
      ';var kind=' +
      JSON.stringify(kind) +
      ';' +
      SCRIPT_
    );
  }

  /**
   * Opens a print dialog over the sheet.
   *
   * @param {string} kind `reservations` or `teams`.
   * @param {string} title The title of the dialog.
   */
  function showPrintDialog_(kind, title) {
    var html = HtmlService.createHtmlOutput(printDialogHtml_(kind))
      .setWidth(WIDTH_PX_)
      .setHeight(HEIGHT_PX_);
    SpreadsheetApp.getUi().showModalDialog(html, title);
  }

  return {
    showPrintDialog: showPrintDialog_,
    printDialogHtml: printDialogHtml_,
    menuPrintOptions
  };
})();
