/** Creating, changing, copying and deleting forms with their sheets. */

var FormsService = (function () {
  function uniqueSlug_(wanted) {
    var taken = {};
    FormsRepository.readForms().forEach(function (f) {
      taken[f.slug] = true;
    });
    var base = Text.slugify(wanted),
      slug = base,
      n = 2;
    while (taken[slug]) slug = base + '-' + n++;
    return slug;
  }

  /** Creates the form's own spreadsheet inside the platform folder. */
  function attachSheet_(form) {
    var metadata = FormMetadata.sheet(form);
    var ss = SpreadsheetApp.create(
      form.title + (metadata ? ' - ' + metadata : '')
    );
    var first = ss.getSheets()[0];
    first.setName('Responses');
    first
      .getRange(1, 1, 1, ResponsesRepository.RESPONSE_COLS.length)
      .setValues([ResponsesRepository.RESPONSE_COLS])
      .setFontWeight('bold');
    first
      .getRange(
        1,
        1,
        first.getMaxRows(),
        ResponsesRepository.RESPONSE_COLS.length
      )
      .setNumberFormat('@');
    first.setFrozenRows(1);
    SheetStyle.styleDataTab(first, ResponsesRepository.RESPONSE_COLS);
    DriveApp.getFileById(ss.getId()).moveTo(RegistryRepository.rootFolder());
    form.sheetId = ss.getId();
    form.sheetUrl = ss.getUrl();
  }

  /** A subject code such as CMPn323: letters, digits, and dashes, no spaces. */
  function cleanSubject_(v) {
    return String(v || '')
      .replace(/\s+/g, '')
      .replace(/[^A-Za-z0-9\-]/g, '')
      .slice(0, 20);
  }

  /**
   * Gives a new form its sheet and its row. The sheet is made first, outside the lock, because
   * Google takes seconds to create one; the link name is chosen and the row written inside it.
   * `adjust` may change the form before it is saved.
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

  function createForm(o, adjust) {
    if (Object.values(FormType).indexOf(o.type) === -1)
      ApiError.fail('unknown_type', 'Unknown form type.');
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

  var PATCHABLE_ = [
    'title',
    'slug',
    'status',
    'opensAt',
    'closesAt',
    'lang',
    'icon',
    'steps',
    'fields',
    'slots',
    'rules',
    'review',
    'matching',
    'editKey',
    'notifications',
    'messages',
    'keyBooking'
  ];

  /**
   * Changes a form. `base` is the `updatedAt` of the copy the page was showing: when the form
   * has been saved since, the change is refused instead of overwriting the newer one.
   */
  function updateForm(id, patch, base) {
    return Lock.withLock(function () {
      return applyFormPatch_(FormsRepository.requireForm(id), patch, base);
    });
  }

  function applyFormPatch_(form, patch, base) {
    if (base && String(base) !== form.updatedAt) {
      ApiError.fail(
        'stale',
        'This form was changed in another window since you opened it. Press Discard to load the latest, then make your change again.'
      );
    }
    FormMetadata.update(form, patch);
    PATCHABLE_.forEach(function (k) {
      if (patch[k] === undefined) return;
      if (k === 'status' && Constants.FORM_STATUSES.indexOf(patch[k]) === -1)
        ApiError.fail(
          'bad_status',
          'Status must be draft, open, closed, or archived.'
        );
      if (k === 'rules') {
        form.rules = FormsRules.normalizeRules(form.rules, patch.rules);
        return;
      }
      if (k === 'slots') {
        form.slots = SlotsRules.normalizeSlots(patch.slots);
        return;
      }
      if (k === 'keyBooking') {
        form.keyBooking = KeyBookingService.normalizeKeyBooking(
          form,
          patch.keyBooking
        );
        return;
      }
      if (k === 'slug') {
        var wanted = Text.slugify(patch.slug);
        var clash = FormsRepository.findForm(wanted);
        if (clash && clash.id !== form.id)
          ApiError.fail(
            'slug_taken',
            'Another form already uses that link name.'
          );
        if (wanted !== form.slug) ClientsRepository.keepClientForms();
        form.slug = wanted;
        return;
      }
      form[k] = patch[k];
    });
    if (patch.fields !== undefined || patch.steps !== undefined)
      FormsQuestions.normalizeQuestions(form);
    return FormsRepository.saveForm(form);
  }

  function duplicateForm(id, o, adjust) {
    var src = FormsRepository.requireForm(id);
    var copy = Json.clone(src);
    copy.title = (o && o.title) || src.title;
    var metadata = FormMetadata.duplicate(src, o || {});
    FormMetadata.legacyFields(src.type).forEach(function (key) {
      delete copy[key];
    });
    Object.assign(copy, metadata);
    return addForm_(copy, o && o.slug, adjust);
  }

  /**
   * Deletes a form: its registry row goes, its spreadsheet moves to the Drive
   * trash (restorable for 30 days), and private links stop listing it.
   */
  function deleteForm(id) {
    return Lock.withLock(function () {
      return removeForm_(FormsRepository.requireForm(id));
    });
  }

  function removeForm_(form) {
    var sh = FormsRepository.formsSheet();
    sh.deleteRow(FormsRepository.formRow(sh, form.id));
    var trashed = false;
    if (form.sheetId) {
      try {
        DriveApp.getFileById(form.sheetId).setTrashed(true);
        trashed = true;
      } catch (e) {
        Logger.log('Sheet not trashed: ' + e.message);
      }
    }
    try {
      PropertiesService.getScriptProperties().deleteProperty(
        'dirty:' + form.id
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
    return { deleted: true, sheetTrashed: trashed, title: form.title };
  }

  return { createForm, updateForm, duplicateForm, deleteForm };
})();
