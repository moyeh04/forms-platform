/** The current time and date as ISO text. */

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
