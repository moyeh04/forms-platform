/**
 * Every function Apps Script calls by name: the sheet menu, its print dialog,
 * the first setup, the PIN commands and the view trigger. Each one hands the
 * call to the feature that does the work.
 */

/**
 * Stores a new admin PIN.
 *
 * @param {string} pin The new PIN.
 * @return {boolean} True once it is stored.
 */
function setAdminPin(pin) {
  return AuthService.setAdminPin(pin);
}

/**
 * Forgets the wrong PIN tries, which lifts a lock.
 *
 * @return {boolean} True when the page was locked.
 */
function unlockAdmin() {
  return AuthService.unlockAdmin();
}

/**
 * First-time setup of the registry. Safe to run again.
 *
 * @return {!Object} The registry address and the id of its folder.
 */
function setup() {
  return RegistrySetup.setup();
}

/**
 * Time trigger: repaints the sheet views marked as out of date.
 */
function processDirtyViews() {
  SheetViewsScheduler.processDirtyViews();
}
