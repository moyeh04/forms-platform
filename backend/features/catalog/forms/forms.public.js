/** What the public may read of a form, with its list options filled in. */

/**
 * The rules that limit a form to some values: rules.majors for the Majors list, and
 * rules.sections for whichever list of sections the section question reads.
 */
var LIMITED_LISTS_ = ['majors', 'sections'];

/** The rule that limits the choices of a list, or '' when none does. */
function limitRuleOf_(list, info) {
  if (list === 'majors') return 'majors';
  return listKind_(list, info) === 'sections' ? 'sections' : '';
}

/** The values of a list that a form is limited to; empty means every value. */
function allowedValues_(form, list) {
  var m = form && form.rules && form.rules[list];
  return Array.isArray(m) ? m.map(String).filter(Boolean) : [];
}

/** The specializations a form is limited to; empty means everyone. */
function allowedMajors_(form) {
  return allowedValues_(form, 'majors');
}

/** Lists are merged into select fields so the browser gets plain options. */
function resolveOptions_(form, lists, info) {
  info = info || readListInfo();
  function fix(fields) {
    (fields || []).forEach(function (f) {
      if (f.list) f.options = lists[f.list] || [];
      // A form limited to some values of a list only offers (and only accepts) those.
      var rule = f.list ? limitRuleOf_(f.list, info) : '';
      var allowed = rule ? allowedValues_(form, rule) : [];
      if (allowed.length) {
        f.options = f.options.filter(function (o) {
          return allowed.indexOf(String(o.value)) !== -1;
        });
      }
      if (f.fields) fix(f.fields);
    });
  }
  fix(form.fields);
  return form;
}

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

function publicForm(form) {
  var full = resolveOptions_(clone(form), readLists());
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
  out.rules = { maxSubmissions: full.rules ? full.rules.maxSubmissions : null };
  if (full.rules && full.rules.teamSize)
    out.rules.teamSize = full.rules.teamSize;
  if (allowedMajors_(full).length) out.rules.majors = allowedMajors_(full);
  var source = keyBookingSource_(form);
  if (source) out.keyBooking = { title: source.title };
  if (full.rules && full.rules.folderName && full.rules.folderName.enabled) {
    out.rules.folderName = {
      enabled: true,
      subject: String(full.rules.folderName.subject || '')
    };
  }
  return out;
}

/** The form with options resolved, for server-side validation. */
function validationForm(form) {
  return resolveOptions_(clone(form), readLists());
}
