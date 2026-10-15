/** What the public may read of a form, with its list options filled in. */

var FormsPublic = (function () {
  /**
   * The rules that limit a form to some values: rules.majors for the Majors
   * list, and rules.sections for whichever list of sections the section
   * question reads.
   */
  var LIMITED_LISTS_ = ['majors', 'sections'];

  /** The settings of a form the public may read. */
  var PUBLIC_KEYS_ = [
    'slug',
    'type',
    'title',
    'lang',
    'icon',
    'steps',
    'fields',
    'slots',
    'editKey',
    'messages',
    'status',
    'opensAt',
    'closesAt'
  ];

  /** The states in which the public sees only the form's name. */
  var CLOSED_STATES_ = ['draft', 'archived'];

  /**
   * Gives the rule that limits the choices of a list.
   *
   * @param {string} list The key of the list.
   * @param {!Object} info What each list is.
   * @return {string} `majors`, `sections`, or empty when none does.
   */
  function limitRuleOf_(list, info) {
    if (list === 'majors') return 'majors';
    return ListsRepository.listKind(list, info) === ListKind.SECTIONS
      ? 'sections'
      : '';
  }

  /**
   * Reads the values of a list that a form is limited to.
   *
   * @param {?Object} form The form.
   * @param {string} list The rule of the list.
   * @return {!Array<string>} The values; empty means every value.
   */
  function allowedValues_(form, list) {
    var m = form?.rules?.[list];
    return Array.isArray(m) ? m.map(String).filter(Boolean) : [];
  }

  /**
   * Keeps only the options of a list question that the form is limited
   * to: a form limited to some values of a list only offers (and only
   * accepts) those.
   *
   * @param {?Object} form The form.
   * @param {!Object} f The question, changed in place.
   * @param {!Object} info What each list is.
   */
  function limitOptions_(form, f, info) {
    var rule = limitRuleOf_(f.list, info);
    var allowed = rule ? allowedValues_(form, rule) : [];
    if (!allowed.length) return;
    f.options = f.options.filter(function (o) {
      return allowed.indexOf(String(o.value)) !== -1;
    });
  }

  /**
   * Fills the options of the questions that read a list, keeping only the
   * values the form is limited to, in the questions inside them as well.
   *
   * @param {!Object} form The form.
   * @param {!Array<!Object>|undefined} fields The questions, changed in
   *     place.
   * @param {!Object} lists The values of every list.
   * @param {!Object} info What each list is.
   */
  function fillFields_(form, fields, lists, info) {
    (fields || []).forEach(function (f) {
      if (f.list) {
        f.options = lists[f.list] || [];
        limitOptions_(form, f, info);
      }
      if (f.fields) fillFields_(form, f.fields, lists, info);
    });
  }

  /**
   * Merges the lists into the select questions, so the browser gets plain
   * options.
   *
   * @param {!Object} form The form, changed in place.
   * @param {!Object} lists The values of every list.
   * @return {!Object} The form.
   */
  function resolveOptions_(form, lists) {
    fillFields_(form, form.fields, lists, ListsRepository.readListInfo());
    return form;
  }

  /**
   * Makes the rules the public reads of a form.
   *
   * @param {!Object} full The form with its options filled in.
   * @return {!Object} The rules.
   */
  function publicRules_(full) {
    var rules = full.rules || {};
    var out = { maxSubmissions: full.rules ? rules.maxSubmissions : null };
    if (rules.teamSize) out.teamSize = rules.teamSize;
    var majors = allowedValues_(full, 'majors');
    if (majors.length) out.majors = majors;
    return out;
  }

  /**
   * Makes what the public may read of a form.
   *
   * @param {!Object} form The form.
   * @return {!Object} The form for the page.
   */
  function publicForm(form) {
    var full = resolveOptions_(Json.clone(form), ListsRepository.readLists());
    var out = {};
    PUBLIC_KEYS_.forEach(function (k) {
      if (full[k] !== undefined) out[k] = full[k];
    });
    Object.assign(out, FormMetadata.public(full));
    out.editKey = {
      enabled: !!full.editKey.enabled,
      days: full.editKey.days,
      allowEdit: !!full.editKey.allowEdit,
      allowDelete: !!full.editKey.allowDelete
    };
    out.rules = publicRules_(full);
    var source = KeyBookingService.keyBookingSource(form);
    if (source) out.keyBooking = { title: source.title };
    var folderName = full.rules?.folderName;
    if (folderName?.enabled) {
      out.rules.folderName = {
        enabled: true,
        subject: String(folderName.subject || '')
      };
    }
    return out;
  }

  /**
   * Makes what the public sees of a draft or archived form: its name.
   *
   * @param {!Object} form The form.
   * @return {!Object} The name, look and messages of the form.
   */
  function closedForm_(form) {
    var draft = {
      slug: form.slug,
      type: form.type,
      title: form.title,
      lang: form.lang,
      icon: form.icon,
      messages: form.messages
    };
    return Object.assign(draft, FormMetadata.public(form));
  }

  /**
   * Makes the answer to a student who opens a form: only its name while it
   * is a draft or archived, and otherwise the whole form, the server time
   * and the taken slots of a timetable.
   *
   * @param {!Object} form The form.
   * @return {{state: string, form: !Object}} The state and the form.
   */
  function publicState(form) {
    var state = Rules.formState(form);
    if (CLOSED_STATES_.indexOf(state) !== -1) {
      return { state: state, form: closedForm_(form) };
    }
    var out = {
      state: state,
      form: publicForm(form),
      serverTime: Time.nowIso()
    };
    if (form.type === FormType.RESERVATION) {
      out.taken = SlotsRules.slotAvailability(form);
    }
    return out;
  }

  /**
   * Makes the form with its options filled in, for checking answers on the
   * server.
   *
   * @param {!Object} form The form.
   * @return {!Object} A copy with its options filled in.
   */
  function validationForm(form) {
    return resolveOptions_(Json.clone(form), ListsRepository.readLists());
  }

  return {
    validationForm,
    publicForm,
    publicState,
    LIMITED_LISTS: LIMITED_LISTS_
  };
})();
