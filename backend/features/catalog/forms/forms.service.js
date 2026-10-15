/** Creating, reading, copying and deleting forms with their sheets. */

var FormsService = (function () {
  /** The number the second form with the same link name gets. */
  var FIRST_SUFFIX_ = 2;

  /**
   * Finds a link name no form uses, adding -2, -3 and on when it is taken.
   *
   * @param {*} wanted The name the link should have.
   * @return {string} The link name.
   */
  function uniqueSlug_(wanted) {
    var taken = {};
    FormsRepository.readForms().forEach(function (f) {
      taken[f.slug] = true;
    });
    var base = Text.slugify(wanted);
    var slug = base;
    var n = FIRST_SUFFIX_;
    while (taken[slug]) slug = base + '-' + n++;
    return slug;
  }

  /**
   * Creates the form's own spreadsheet inside the platform folder.
   *
   * @param {!Object} form The form; its `sheetId` and `sheetUrl` are set.
   */
  function attachSheet_(form) {
    var cols = ResponsesRepository.RESPONSE_COLS;
    var metadata = FormMetadata.sheet(form);
    var ss = SpreadsheetApp.create(
      form.title + (metadata ? ' - ' + metadata : '')
    );
    var first = ss.getSheets()[0];
    first.setName('Responses');
    first
      .getRange(1, 1, 1, cols.length)
      .setValues([cols])
      .setFontWeight('bold');
    first.getRange(1, 1, first.getMaxRows(), cols.length).setNumberFormat('@');
    first.setFrozenRows(1);
    SheetStyle.styleDataTab(first, cols);
    DriveApp.getFileById(ss.getId()).moveTo(RegistryRepository.rootFolder());
    form.sheetId = ss.getId();
    form.sheetUrl = ss.getUrl();
  }

  /**
   * Gives a new form its sheet and its row. The sheet is made first,
   * outside the lock, because Google takes seconds to create one; the link
   * name is chosen and the row written inside it.
   *
   * @param {!Object} form The new form.
   * @param {*} wantedSlug The link name asked for, or nothing.
   * @param {?function(!Object)=} adjust Changes the form before it is
   *     saved.
   * @return {!Object} The saved form.
   */
  function addForm_(form, wantedSlug, adjust) {
    form.id = Crypto.shortId('f_');
    form.status = 'draft';
    form.createdAt = Time.nowIso();
    attachSheet_(form);
    return Lock.withLock(function () {
      form.slug = uniqueSlug_(
        wantedSlug || form.title + ' ' + FormMetadata.slug(form)
      );
      if (adjust) adjust(form);
      return FormsRepository.saveForm(form);
    });
  }

  /**
   * Creates a form from the template of its type.
   *
   * @param {!Object} o The request: `type`, `title`, the `slug` asked for
   *     and the metadata of the type.
   * @param {?function(!Object)=} adjust Changes the form before it is
   *     saved.
   * @return {!Object} The saved form.
   * @throws {ApiError} `unknown_type` or `title_required`.
   */
  function createForm(o, adjust) {
    if (Object.values(FormType).indexOf(o.type) === -1) {
      ApiError.fail('unknown_type', 'Unknown form type.');
    }
    var title = String(o.title || '').trim();
    if (!title) ApiError.fail('title_required', 'Give the form a title.');
    var form = TemplatesService.templateFor(o.type);
    form.type = o.type;
    form.title = title;
    Object.assign(form, FormMetadata.create(form.type, o));
    form.opensAt = '';
    form.closesAt = '';
    return addForm_(form, o.slug, adjust);
  }

  /**
   * Copies a form, with a new sheet and no responses.
   *
   * @param {string} id The id of the form.
   * @param {?Object} o The request: a new `title`, `slug` and metadata.
   * @param {?function(!Object)=} adjust Changes the copy before it is
   *     saved.
   * @return {!Object} The saved copy.
   */
  function duplicateForm(id, o, adjust) {
    var src = FormsRepository.requireForm(id);
    var copy = Json.clone(src);
    copy.title = o?.title || src.title;
    var metadata = FormMetadata.duplicate(src, o || {});
    FormMetadata.legacyFields(src.type).forEach(function (key) {
      delete copy[key];
    });
    Object.assign(copy, metadata);
    return addForm_(copy, o?.slug, adjust);
  }

  /**
   * Moves a form's spreadsheet to the Drive trash.
   *
   * @param {!Object} form The form.
   * @return {boolean} True when it was trashed.
   */
  function trashSheet_(form) {
    if (!form.sheetId) return false;
    try {
      DriveApp.getFileById(form.sheetId).setTrashed(true);
      return true;
    } catch (e) {
      Logger.log('Sheet not trashed: ' + e.message);
      return false;
    }
  }

  /**
   * Takes a deleted form out of its out-of-date mark and its client links.
   *
   * @param {!Object} form The form.
   */
  function forgetForm_(form) {
    try {
      PropertiesService.getScriptProperties().deleteProperty(
        Constants.PROPS.DIRTY_PREFIX + form.id
      );
    } catch (e) {
      /* nothing to clean */
    }
    ClientsRepository.readClients().forEach(function (c) {
      if (c.forms.indexOf(form.id) === -1) return;
      c.forms = c.forms.filter(function (s) {
        return s !== form.id;
      });
      ClientsRepository.saveClient(c);
    });
  }

  /**
   * Deletes a form: its registry row goes, its spreadsheet moves to the
   * Drive trash (restorable for 30 days), and private links stop listing
   * it.
   *
   * @param {string} id The id of the form.
   * @return {{deleted: boolean, sheetTrashed: boolean, title: string}} What
   *     was done.
   */
  function deleteForm(id) {
    return Lock.withLock(function () {
      var form = FormsRepository.requireForm(id);
      FormsRepository.deleteForm(form.id);
      var trashed = trashSheet_(form);
      forgetForm_(form);
      return { deleted: true, sheetTrashed: trashed, title: form.title };
    });
  }

  /**
   * Deletes a form when the request names its link name as well, so a
   * stray call cannot delete a form.
   *
   * @param {string} id The id of the form.
   * @param {*} confirm The link name the page sent back.
   * @return {{deleted: boolean, sheetTrashed: boolean, title: string}} What
   *     was done.
   * @throws {ApiError} `confirm_required` when the name does not match.
   */
  function deleteConfirmed(id, confirm) {
    var form = FormsRepository.requireForm(id);
    if (String(confirm || '') !== form.slug) {
      ApiError.fail(
        'confirm_required',
        'Confirm by sending the form link name.'
      );
    }
    return deleteForm(form.id);
  }

  /**
   * Reads every form.
   *
   * @return {!Array<!Object>} The forms.
   */
  function listForms() {
    return FormsRepository.readForms();
  }

  /**
   * Reads a form by its slug or id, for the controllers of every feature.
   *
   * @param {*} slugOrId The slug or id of the form.
   * @return {!Object} The form.
   * @throws {ApiError} `form_not_found` when there is no such form.
   */
  function requireForm(slugOrId) {
    return FormsRepository.requireForm(slugOrId);
  }

  /**
   * Shows a form to the admin editor, with the lists, the bookings of the
   * timetable, the forms whose keys can book, and the counts of saved
   * answers that a new team size range would leave outside, and for a team
   * registration how many teams have marks on each milestone.
   *
   * @param {string} id The id of the form.
   * @return {!Object} The form and what its editor needs.
   */
  function adminForm(id) {
    var form = FormsRepository.requireForm(id);
    var out = {
      form: form,
      lists: ListsRepository.readLists(),
      listInfo: ListsRepository.readListInfo()
    };
    var reservation = form.type === FormType.RESERVATION;
    if (reservation) {
      out.taken = SlotsRules.slotAvailability(form);
      out.keySources = KeyBookingService.keyBookingSources(form).map(
        function (s) {
          return { id: s.id, title: s.title, term: FormMetadata.slug(s) };
        }
      );
    }
    if (Rules.fieldByRole(form, 'team_size')) {
      out.teamSizes = ResponsesRules.teamSizes(form);
    }
    if (reservation && Rules.fieldByRole(form, 'members')) {
      out.teammateCounts = ResponsesRules.teammateCounts(form);
    }
    if (form.type === FormType.TEAM_REGISTRATION) {
      out.progressMarks = ProgressService.markCounts(form);
    }
    return out;
  }

  return {
    createForm,
    duplicateForm,
    deleteForm,
    deleteConfirmed,
    listForms,
    requireForm,
    adminForm
  };
})();
