/** The questions and pages an admin adds to a form. */

/**
 * Questions an admin adds to a form. A built-in question comes from the template of
 * the form type; a custom one has `custom: true`, an id that starts with "q_", and one
 * of the plain types below. Answers are kept in the `data` JSON of the response under
 * the id of the question, so adding or removing a question never changes a sheet column.
 */
var CUSTOM_TYPES_ = ['text', 'textarea', 'select'];

var CUSTOM_LIMIT_ = 30;

var PAGE_LIMIT_ = 12;

function customLabel_(label) {
  var en = String((label && label.en) || '')
    .trim()
    .slice(0, 120);
  var ar = String((label && label.ar) || '')
    .trim()
    .slice(0, 120);
  if (!en && !ar) ApiError.fail('bad_question', 'A question needs a label.');
  return { en: en || ar, ar: ar || en };
}

/** One choice per value; the value is what is stored, so it is the English text. */
function customOptions_(options) {
  var seen = {};
  var out = [];
  (Array.isArray(options) ? options : []).forEach(function (o) {
    var label = customLabel_(
      typeof o === 'object' ? o.label || { en: o.value } : { en: o }
    );
    var value = String((typeof o === 'object' && o.value) || label.en)
      .trim()
      .slice(0, 120);
    if (!value || seen[value]) return;
    seen[value] = true;
    out.push({ value: value, label: label });
  });
  if (out.length < 2)
    ApiError.fail(
      'bad_question',
      'A choice question needs at least two different choices.'
    );
  return out.slice(0, 50);
}

function customField_(f, taken) {
  if (CUSTOM_TYPES_.indexOf(f.type) === -1)
    ApiError.fail('bad_question', 'That kind of question cannot be added.');
  var id =
    /^q_[a-z0-9]{1,16}$/.test(String(f.id)) && !taken[f.id]
      ? String(f.id)
      : Crypto.shortId('q_')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '');
  var out = {
    id: id,
    type: f.type,
    custom: true,
    label: customLabel_(f.label),
    required: f.required !== false,
    enabled: f.enabled !== false
  };
  if (f.help && (f.help.en || f.help.ar))
    out.help = {
      en: String(f.help.en || '').slice(0, 500),
      ar: String(f.help.ar || '').slice(0, 500)
    };
  if (f.type === 'select') out.options = customOptions_(f.options);
  return out;
}

/**
 * Run after a patch of `fields` or `steps`: cleans the custom questions, gives each page an
 * id and a title, and keeps each page listing only questions that exist, each one once.
 */
function normalizeQuestions_(form) {
  var taken = {};
  var custom = 0;
  (form.fields || []).forEach(function (f) {
    if (!f.custom) taken[f.id] = true;
  });
  form.fields = (form.fields || []).map(function (f) {
    if (!f.custom) return f;
    if (++custom > CUSTOM_LIMIT_)
      ApiError.fail(
        'bad_question',
        'A form can have at most ' + CUSTOM_LIMIT_ + ' added questions.'
      );
    var clean = customField_(f, taken);
    taken[clean.id] = true;
    return clean;
  });
  // A question that reads a list may read any list that exists; the admin picks it in the Questions tab.
  var lists = readLists();
  var known = function (fields) {
    (fields || []).forEach(function (f) {
      if (f.list && !lists.hasOwnProperty(f.list))
        ApiError.fail('list_not_found', 'The list "' + f.list + '" does not exist.');
      known(f.fields);
    });
  };
  known(form.fields);
  var placed = {};
  var pages = {};
  if ((form.steps || []).length > PAGE_LIMIT_)
    ApiError.fail('bad_question', 'A form can have at most ' + PAGE_LIMIT_ + ' pages.');
  (form.steps || []).forEach(function (step) {
    // A page keeps its id; a new or repeated one gets a fresh id. The title is what students read on the route.
    if (!/^[a-z0-9_]{1,24}$/.test(String(step.id)) || pages[step.id])
      step.id = Crypto.shortId('p_')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
    pages[step.id] = true;
    var en = String((step.title && step.title.en) || '')
      .trim()
      .slice(0, 60);
    var ar = String((step.title && step.title.ar) || '')
      .trim()
      .slice(0, 60);
    if (!en && !ar) ApiError.fail('bad_question', 'A page needs a title.');
    step.title = { en: en || ar, ar: ar || en };
    step.fields = (step.fields || []).map(String).filter(function (id) {
      if (!taken[id] || placed[id]) return false;
      placed[id] = true;
      return true;
    });
  });
  return form;
}
