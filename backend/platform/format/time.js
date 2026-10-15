/** The current time and date as ISO text. */

var Time = (function () {
function nowIso() {
  return new Date().toISOString();
}

function todayIso_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

return { nowIso, todayIso: todayIso_ };
})();
