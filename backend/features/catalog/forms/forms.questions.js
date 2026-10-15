/** The questions and pages an admin adds to a form. */

var FormsQuestions = (function () {
  /**
   * Questions an admin adds to a form. A built-in question comes from the
   * template of the form type; a custom one has `custom: true`, an id that
   * starts with "q_", and one of the plain types below. Answers are kept in
   * the `data` JSON of the response under the id of the question, so adding
   * or removing a question never changes a sheet column.
   */
  var CUSTOM_TYPES_ = ['text', 'textarea', 'select'];

  /** The most questions an admin may add. */
  var CUSTOM_LIMIT_ = 30;

  /** The most pages a form may have. */
  var PAGE_LIMIT_ = 12;

  /** The longest label or choice. */
  var LABEL_MAX_ = 120;

  /** The longest help text. */
  var HELP_MAX_ = 500;

  /** The longest page title. */
  var PAGE_TITLE_MAX_ = 60;

  /** The most choices a question may have. */
  var CHOICES_MAX_ = 50;

  /** The fewest choices a choice question needs. */
  var CHOICES_MIN_ = 2;

  /** The id an added question may keep. */
  var QUESTION_ID_ = /^q_[a-z0-9]{1,16}$/;

  /** The id a page may keep. */
  var PAGE_ID_ = /^[a-z0-9_]{1,24}$/;

  /**
   * Makes a fresh id after a prefix, in the letters an id may hold.
   *
   * @param {string} prefix What it starts with.
   * @return {string} The id.
   */
  function freshId_(prefix) {
    return Crypto.shortId(prefix)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Cleans an English and Arabic text pair, each falling back on the
   * other.
   *
   * @param {?Object} text The pair.
   * @param {number} max The longest text.
   * @return {?{en: string, ar: string}} The pair, or null when both are
   *     empty.
   */
  function textPair_(text, max) {
    var en = String(text?.en || '')
      .trim()
      .slice(0, max);
    var ar = String(text?.ar || '')
      .trim()
      .slice(0, max);
    if (!en && !ar) return null;
    return { en: en || ar, ar: ar || en };
  }

  /**
   * Cleans the label of a question or choice.
   *
   * @param {?Object} label The label.
   * @return {{en: string, ar: string}} The label.
   * @throws {ApiError} `bad_question` when it is empty.
   */
  function customLabel_(label) {
    var pair = textPair_(label, LABEL_MAX_);
    if (!pair) ApiError.fail('bad_question', 'A question needs a label.');
    return pair;
  }

  /**
   * Cleans the choices of a question: one choice per value; the value is
   * what is stored, so it is the English text.
   *
   * @param {*} options The choices.
   * @return {!Array<{value: string, label: !Object}>} The choices.
   * @throws {ApiError} `bad_question` with fewer than two.
   */
  function customOptions_(options) {
    var seen = {};
    var out = [];
    (Array.isArray(options) ? options : []).forEach(function (o) {
      var isObject = typeof o === 'object';
      var label = customLabel_(
        isObject ? o.label || { en: o.value } : { en: o }
      );
      var value = String((isObject && o.value) || label.en)
        .trim()
        .slice(0, LABEL_MAX_);
      if (!value || seen[value]) return;
      seen[value] = true;
      out.push({ value: value, label: label });
    });
    if (out.length < CHOICES_MIN_) {
      ApiError.fail(
        'bad_question',
        'A choice question needs at least two different choices.'
      );
    }
    return out.slice(0, CHOICES_MAX_);
  }

  /**
   * Cleans one added question.
   *
   * @param {!Object} f The question.
   * @param {!Object<string, boolean>} taken The ids in use.
   * @return {!Object} The question.
   * @throws {ApiError} `bad_question`.
   */
  function customField_(f, taken) {
    if (CUSTOM_TYPES_.indexOf(f.type) === -1) {
      ApiError.fail('bad_question', 'That kind of question cannot be added.');
    }
    var keep = QUESTION_ID_.test(String(f.id)) && !taken[f.id];
    var out = {
      id: keep ? String(f.id) : freshId_('q_'),
      type: f.type,
      custom: true,
      label: customLabel_(f.label),
      required: f.required !== false,
      enabled: f.enabled !== false
    };
    if (f.help && (f.help.en || f.help.ar)) {
      out.help = {
        en: String(f.help.en || '').slice(0, HELP_MAX_),
        ar: String(f.help.ar || '').slice(0, HELP_MAX_)
      };
    }
    if (f.type === 'select') out.options = customOptions_(f.options);
    return out;
  }

  /**
   * Refuses a question that reads a list that does not exist. A question
   * may read any list that exists; the admin picks it in the Questions tab.
   *
   * @param {!Array<!Object>|undefined} fields The questions.
   * @param {!Object} lists Every list by key.
   * @throws {ApiError} `list_not_found`.
   */
  function checkLists_(fields, lists) {
    (fields || []).forEach(function (f) {
      if (f.list && Object.keys(lists).indexOf(f.list) === -1) {
        ApiError.fail(
          'list_not_found',
          'The list "' + f.list + '" does not exist.'
        );
      }
      checkLists_(f.fields, lists);
    });
  }

  /**
   * Cleans the added questions and notes every id in use.
   *
   * @param {!Object} form The form, changed in place.
   * @return {!Object<string, boolean>} The ids of every question.
   * @throws {ApiError} `bad_question` past the limit of added questions.
   */
  function cleanFields_(form) {
    var taken = {};
    var custom = 0;
    (form.fields || []).forEach(function (f) {
      if (!f.custom) taken[f.id] = true;
    });
    form.fields = (form.fields || []).map(function (f) {
      if (!f.custom) return f;
      if (++custom > CUSTOM_LIMIT_) {
        ApiError.fail(
          'bad_question',
          'A form can have at most ' + CUSTOM_LIMIT_ + ' added questions.'
        );
      }
      var clean = customField_(f, taken);
      taken[clean.id] = true;
      return clean;
    });
    return taken;
  }

  /**
   * Cleans one page. A page keeps its id; a new or repeated one gets a
   * fresh id. The title is what students read on the route.
   *
   * @param {!Object} step The page, changed in place.
   * @param {!Object<string, boolean>} taken The ids of every question.
   * @param {{pages: !Object, placed: !Object}} seen The page ids and the
   *     questions already on a page.
   * @throws {ApiError} `bad_question` when it has no title.
   */
  function cleanPage_(step, taken, seen) {
    if (!PAGE_ID_.test(String(step.id)) || seen.pages[step.id]) {
      step.id = freshId_('p_');
    }
    seen.pages[step.id] = true;
    var title = textPair_(step.title, PAGE_TITLE_MAX_);
    if (!title) ApiError.fail('bad_question', 'A page needs a title.');
    step.title = title;
    step.fields = (step.fields || []).map(String).filter(function (id) {
      if (!taken[id] || seen.placed[id]) return false;
      seen.placed[id] = true;
      return true;
    });
  }

  /**
   * Cleans the questions and pages after a patch of `fields` or `steps`:
   * the added questions, an id and a title for each page, and each page
   * listing only questions that exist, each one once.
   *
   * @param {!Object} form The form, changed in place.
   * @return {!Object} The form.
   * @throws {ApiError} `bad_question` or `list_not_found`.
   */
  function normalizeQuestions_(form) {
    var taken = cleanFields_(form);
    checkLists_(form.fields, ListsRepository.readLists());
    if ((form.steps || []).length > PAGE_LIMIT_) {
      ApiError.fail(
        'bad_question',
        'A form can have at most ' + PAGE_LIMIT_ + ' pages.'
      );
    }
    var seen = { pages: {}, placed: {} };
    (form.steps || []).forEach(function (step) {
      cleanPage_(step, taken, seen);
    });
    return form;
  }

  return { normalizeQuestions: normalizeQuestions_ };
})();
