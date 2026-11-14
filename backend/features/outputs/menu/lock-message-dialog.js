/**
 * The dialog the sheet menu opens to set what the shared admin lock answers.
 * The text is the owner's, kept in a script property, never in the source.
 */

var LockMessageDialog = (function () {
  /** The width of the dialog, in pixels. */
  var WIDTH_PX_ = 520;

  /** The height of the dialog, in pixels. */
  var HEIGHT_PX_ = 440;

  /** The style sheet of the dialog. */
  var STYLE_ = [
    "<style>",
    "body{font-family:Arial,sans-serif;padding:8px;font-size:14px}",
    "textarea{width:100%;height:260px;font:inherit;box-sizing:border-box}",
    "button{font-size:14px;padding:6px 12px;margin:8px 8px 0 0}",
    "</style>",
  ].join("");

  /** The script of the dialog: saves the text, or clears it. */
  var SCRIPT_ = [
    "<script>",
    'var t=document.getElementById("text"),o=document.getElementById("out");',
    'function save(v){o.textContent="Saving...";',
    "google.script.run.withSuccessHandler(function(own){",
    'o.textContent=own?"Saved.":"Saved. The plain message is back.";',
    'if(!own)t.value=""})',
    ".withFailureHandler(function(e){o.textContent=e.message})",
    ".saveLockMessage(v)}",
    'document.getElementById("save").onclick=function(){save(t.value)};',
    'document.getElementById("plain").onclick=function(){save("")};',
    "</script>",
  ].join("");

  /**
   * Makes the page of the dialog, with the current message in its box.
   *
   * @return {string} The HTML of the dialog.
   */
  function dialogHtml() {
    return (
      STYLE_ +
      "<p>A browser that is not trusted sees this after too many wrong " +
      "PINs, with the time left. Leave an empty line between " +
      "paragraphs. Empty means the plain message.</p>" +
      '<textarea id="text">' +
      Text.esc(AuthService.lockMessage()) +
      "</textarea>" +
      '<button id="save">Save</button>' +
      '<button id="plain">Use the plain message</button>' +
      '<div id="out" role="status"></div>' +
      SCRIPT_
    );
  }

  /** Opens the dialog over the sheet. */
  function show() {
    var html = HtmlService.createHtmlOutput(dialogHtml()).setWidth(WIDTH_PX_).setHeight(HEIGHT_PX_);
    SpreadsheetApp.getUi().showModalDialog(html, "Set lock message");
  }

  return { dialogHtml, show };
})();
