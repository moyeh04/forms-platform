/**
 * The "Forms Platform" menu inside the registry spreadsheet.
 * Everything an owner needs without touching code: first-time setup,
 * the admin PIN, one-click printing, and unlocking the admin page.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Forms Platform')
    .addItem('1. First-time setup', 'menuSetup')
    .addItem('2. Set admin PIN...', 'menuSetPin')
    .addItem('3. Set website address (for emails)...', 'menuSetSiteUrl')
    .addSeparator()
    .addItem('Print reservations for a day...', 'menuPrintReservations')
    .addItem('Print team list...', 'menuPrintTeamList')
    .addItem('Rebuild all views', 'menuRebuildViews')
    .addSeparator()
    .addItem('Unlock the admin page', 'menuUnlockAdmin')
    .addToUi();
}

function menuSetup() {
  var ui = SpreadsheetApp.getUi();
  var r = setup();
  ui.alert(
    'Setup finished',
    'The registry is ready. Next, set the admin PIN from the same menu.\n\nForm files will be saved in your Drive folder "Forms Platform".',
    ui.ButtonSet.OK
  );
  return r;
}

function menuSetPin() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Admin PIN',
    'Choose a PIN with at least 4 characters. You will type it on the admin page.',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  try {
    setAdminPin(res.getResponseText());
    ui.alert('Done', 'The admin PIN was saved.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Not saved', e.message, ui.ButtonSet.OK);
  }
}

function menuUnlockAdmin() {
  var ui = SpreadsheetApp.getUi();
  if (unlockAdmin())
    ui.alert(
      'Unlocked',
      'The admin page takes the PIN again. The PIN is the same.',
      ui.ButtonSet.OK
    );
  else
    ui.alert(
      'Not locked',
      'The admin page was not locked. If the PIN is refused, set a new one with "2. Set admin PIN...".',
      ui.ButtonSet.OK
    );
}

function menuSetSiteUrl() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Website address',
    'Paste the address of your forms website, for example https://name.github.io/forms. Confirmation emails will link to it.',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  setProp('SITE_URL', String(res.getResponseText()).trim());
}

function menuPrintReservations() {
  showPrintDialog_('reservations', 'Print reservations for a day');
}

function menuPrintTeamList() {
  showPrintDialog_('teams', 'Print team list');
}

/** Called by the dialog. */
function menuPrint(kind, slug, dayId, includeEmpty) {
  var form = requireForm(slug);
  var printed =
    kind === 'reservations'
      ? printReservations_(form, dayId, includeEmpty)
      : printTeamList_(form);
  return printResult_(form, printed);
}

function menuRebuildViews() {
  var ui = SpreadsheetApp.getUi();
  var n = 0;
  styleRegistryTabs_();
  readForms().forEach(function (f) {
    if (rebuildViews(f)) n++;
  });
  ui.alert(
    'Views rebuilt',
    n +
      ' form(s) updated. Every data tab has its header, widths and row tints.',
    ui.ButtonSet.OK
  );
}
