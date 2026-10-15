/**
 * The "Forms Platform" menu inside the registry spreadsheet.
 * Everything an owner needs without touching code: first-time setup,
 * the admin PIN, one-click printing, and unlocking the admin page.
 */

var MenuService = (function () {
  /** Adds the menu to the spreadsheet when it opens. */
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

  /**
   * Runs the first-time setup and says what to do next.
   *
   * @return {{registryUrl: string, folderId: ?string}} What setup made.
   */
  function menuSetup() {
    var ui = SpreadsheetApp.getUi();
    var r = RegistrySetup.setup();
    ui.alert(
      'Setup finished',
      'The registry is ready. Next, set the admin PIN from the same menu.' +
        '\n\nForm files will be saved in your Drive folder "Forms Platform".',
      ui.ButtonSet.OK
    );
    return r;
  }

  /** Asks for a new admin PIN and saves it. */
  function menuSetPin() {
    var ui = SpreadsheetApp.getUi();
    var res = ui.prompt(
      'Admin PIN',
      'Choose a PIN with at least 4 characters. ' +
        'You will type it on the admin page.',
      ui.ButtonSet.OK_CANCEL
    );
    if (res.getSelectedButton() !== ui.Button.OK) return;
    try {
      AuthService.setAdminPin(res.getResponseText());
      ui.alert('Done', 'The admin PIN was saved.', ui.ButtonSet.OK);
    } catch (e) {
      ui.alert('Not saved', e.message, ui.ButtonSet.OK);
    }
  }

  /** Unlocks the admin page after too many wrong PINs. */
  function menuUnlockAdmin() {
    var ui = SpreadsheetApp.getUi();
    if (AuthService.unlockAdmin())
      ui.alert(
        'Unlocked',
        'The admin page takes the PIN again. The PIN is the same.',
        ui.ButtonSet.OK
      );
    else
      ui.alert(
        'Not locked',
        'The admin page was not locked. If the PIN is refused, ' +
          'set a new one with "2. Set admin PIN...".',
        ui.ButtonSet.OK
      );
  }

  /** Asks for the address of the forms website and saves it. */
  function menuSetSiteUrl() {
    var ui = SpreadsheetApp.getUi();
    var res = ui.prompt(
      'Website address',
      'Paste the address of your forms website, for example ' +
        'https://name.github.io/forms. Confirmation emails will link to it.',
      ui.ButtonSet.OK_CANCEL
    );
    if (res.getSelectedButton() !== ui.Button.OK) return;
    Properties.setProp(
      Constants.PROPS.SITE_URL,
      String(res.getResponseText()).trim()
    );
  }

  /** Opens the dialog that prints the reservations of a day. */
  function menuPrintReservations() {
    PrintDialog.showPrintDialog('reservations', 'Print reservations for a day');
  }

  /** Opens the dialog that prints a team list. */
  function menuPrintTeamList() {
    PrintDialog.showPrintDialog('teams', 'Print team list');
  }

  /**
   * Prints a form, as the print dialog asks.
   *
   * @param {string} kind `reservations` or `teams`.
   * @param {string} slug The slug of the form.
   * @param {string} dayId The day to print, for reservations.
   * @param {boolean} includeEmpty True to list the free slots too.
   * @return {!Object} The links of the printed sheet and PDF.
   */
  function menuPrint(kind, slug, dayId, includeEmpty) {
    var form = FormsRepository.requireForm(slug);
    var printed =
      kind === 'reservations'
        ? PrintService.printReservations(form, dayId, includeEmpty)
        : PrintService.printTeamList(form);
    return PrintService.printResult(form, printed);
  }

  /** Repaints the registry tabs and rebuilds the views of every form. */
  function menuRebuildViews() {
    var ui = SpreadsheetApp.getUi();
    var n = 0;
    RegistrySetup.styleRegistryTabs();
    FormsRepository.readForms().forEach(function (f) {
      if (SheetViewsScheduler.rebuildViews(f)) n++;
    });
    ui.alert(
      'Views rebuilt',
      n +
        ' form(s) updated. ' +
        'Every data tab has its header, widths and row tints.',
      ui.ButtonSet.OK
    );
  }

  return {
    onOpen,
    menuSetup,
    menuSetPin,
    menuSetSiteUrl,
    menuUnlockAdmin,
    menuPrintReservations,
    menuPrintTeamList,
    menuRebuildViews,
    menuPrint
  };
})();
