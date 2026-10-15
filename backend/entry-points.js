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

/**
 * Draws the Forms Platform menu when the registry sheet opens.
 */
function onOpen() {
  MenuService.onOpen();
}

/**
 * Menu item: first-time setup.
 *
 * @return {!Object} What setup returned.
 */
function menuSetup() {
  return MenuService.menuSetup();
}

/**
 * Menu item: asks for a new admin PIN and stores it.
 */
function menuSetPin() {
  MenuService.menuSetPin();
}

/**
 * Menu item: unlocks the admin page after wrong PINs.
 */
function menuUnlockAdmin() {
  MenuService.menuUnlockAdmin();
}

/**
 * Menu item: asks for the website address used in emails.
 */
function menuSetSiteUrl() {
  MenuService.menuSetSiteUrl();
}

/**
 * Menu item: opens the dialog that prints the bookings of a day.
 */
function menuPrintReservations() {
  MenuService.menuPrintReservations();
}

/**
 * Menu item: opens the dialog that prints a team list.
 */
function menuPrintTeamList() {
  MenuService.menuPrintTeamList();
}

/**
 * Called by the print dialog: prints one form.
 *
 * @param {string} kind What to print: reservations or teams.
 * @param {string} slug The link name of the form.
 * @param {string} dayId The day to print, for reservations.
 * @param {boolean} includeEmpty True to print empty slots too.
 * @return {!Object} The printed sheet and its PDF.
 */
function menuPrint(kind, slug, dayId, includeEmpty) {
  return MenuService.menuPrint(kind, slug, dayId, includeEmpty);
}

/**
 * Menu item: rebuilds the sheet views of every form.
 */
function menuRebuildViews() {
  MenuService.menuRebuildViews();
}

/**
 * The forms, with their days, a print dialog can offer.
 *
 * @param {string} kind What to print: reservations or teams.
 * @return {!Array<!Object>} One entry for each form.
 */
function menuPrintOptions(kind) {
  return PrintDialog.menuPrintOptions(kind);
}
