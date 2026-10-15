/**
 * Changing a form: which settings a patch may change, how each one is
 * cleaned, and refusing a change made on an old copy.
 */

var FormsPatch = (function () {
  /** The settings a patch may change. */
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
   * Refuses a status that is not one of the form states.
   *
   * @param {*} status The new status.
   * @throws {ApiError} `bad_status`.
   */
  function checkStatus_(status) {
    if (Object.values(FormStatus).indexOf(status) === -1) {
      ApiError.fail(
        'bad_status',
        'Status must be draft, open, closed, or archived.'
      );
    }
  }

  /**
   * Changes the link name of a form, refusing one another form uses.
   *
   * @param {!Object} form The form, changed in place.
   * @param {*} slug The new link name.
   * @throws {ApiError} `slug_taken`.
   */
  function setSlug_(form, slug) {
    var wanted = Text.slugify(slug);
    var clash = FormsRepository.findForm(wanted);
    if (clash && clash.id !== form.id) {
      ApiError.fail('slug_taken', 'Another form already uses that link name.');
    }
    if (wanted !== form.slug) ClientsRepository.keepClientForms();
    form.slug = wanted;
  }

  /**
   * Writes one setting of a patch, cleaned the way that setting needs.
   *
   * @param {!Object} form The form, changed in place.
   * @param {string} k The setting.
   * @param {!Object} patch The patch.
   */
  function applyKey_(form, k, patch) {
    if (k === 'status') checkStatus_(patch.status);
    if (k === 'rules') {
      form.rules = FormsRules.normalizeRules(form.rules, patch.rules);
    } else if (k === 'slots') {
      form.slots = SlotsRules.normalizeSlots(patch.slots);
    } else if (k === 'keyBooking') {
      form.keyBooking = KeyBookingService.normalizeKeyBooking(
        form,
        patch.keyBooking
      );
    } else if (k === 'slug') {
      setSlug_(form, patch.slug);
    } else {
      form[k] = patch[k];
    }
  }

  /**
   * Applies a patch to a form and saves it.
   *
   * @param {!Object} form The form.
   * @param {!Object} patch The settings to change.
   * @param {*} base The `updatedAt` of the copy the page was showing.
   * @return {!Object} The saved form.
   * @throws {ApiError} `stale` when the form was saved since `base`.
   */
  function applyFormPatch_(form, patch, base) {
    if (base && String(base) !== form.updatedAt) {
      ApiError.fail(
        'stale',
        'This form was changed in another window since you opened it. ' +
          'Press Discard to load the latest, then make your change again.'
      );
    }
    FormMetadata.update(form, patch);
    PATCHABLE_.forEach(function (k) {
      if (patch[k] !== undefined) applyKey_(form, k, patch);
    });
    if (patch.fields !== undefined || patch.steps !== undefined) {
      FormsQuestions.normalizeQuestions(form);
    }
    return FormsRepository.saveForm(form);
  }

  /**
   * Changes a form. When the form has been saved since the copy the page
   * was showing, the change is refused instead of overwriting the newer
   * one.
   *
   * @param {string} id The id of the form.
   * @param {!Object} patch The settings to change.
   * @param {*} base The `updatedAt` of the copy the page was showing.
   * @return {!Object} The saved form.
   */
  function updateForm(id, patch, base) {
    return Lock.withLock(function () {
      return applyFormPatch_(FormsRepository.requireForm(id), patch, base);
    });
  }

  return { updateForm };
})();
