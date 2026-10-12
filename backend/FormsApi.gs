/** Form management for the admin and the public form definition. */

var API = API || {};

API.getForm = function (req) {
  var form = requireForm(String(req.slug || ''));
  var state = Rules.formState(form);
  if (state === 'draft' || state === 'archived') {
    var draft = { slug: form.slug, type: form.type, title: form.title, lang: form.lang, icon: form.icon, messages: form.messages };
    Object.assign(draft, FormMetadata.public(form));
    return { state: state, form: draft };
  }
  var out = { state: state, form: publicForm(form), serverTime: nowIso() };
  if (form.type === 'reservation') out.taken = slotAvailability_(form);
  return out;
};

API['admin.forms.list'] = admin(function () {
  var forms = readForms().map(function (f) {
    var o = clone(f);
    delete o._row;
    return o;
  });
  return { forms: forms };
});

API['admin.forms.get'] = admin(function (req) {
  var form = requireForm(req.id);
  var f = clone(form);
  delete f._row;
  var out = { form: f, lists: readLists(), listInfo: readListInfo() };
  // The timetable editor marks slots that already have bookings.
  if (form.type === 'reservation') {
    out.taken = slotAvailability_(form);
    out.keySources = keyBookingSources_(form).map(function (s) { return { id: s.id, title: s.title, term: FormMetadata.slug(s) }; });
  }
  return out;
});

API['admin.forms.create'] = admin(function (req) {
  var f = clone(createForm(req));
  delete f._row;
  return { form: f };
});

API['admin.forms.update'] = admin(function (req) {
  var f = updateForm(req.id, req.patch || {});
  var out = { form: clone(f) };
  delete out.form._row;
  if (req.patch && req.patch.slots && f.type === 'reservation') out.orphanedBookings = orphanedBookings_(f);
  if (req.patch && req.patch.rules && req.patch.rules.teamSize) out.teamSizeConflicts = teamSizeConflicts_(f);
  return out;
});

API['admin.forms.duplicate'] = admin(function (req) {
  var f = clone(duplicateForm(req.id, req));
  delete f._row;
  return { form: f };
});

API['admin.forms.delete'] = admin(function (req) {
  var form = requireForm(req.id);
  // The page sends the link name back as a deliberate second key, so a stray call cannot delete a form.
  if (String(req.confirm || '') !== form.slug) fail('confirm_required', 'Confirm by sending the form link name.');
  return withLock_(function () { return deleteForm(form.id); });
});

function listsOut_() { return { lists: readLists(), info: readListInfo() }; }

function requireList_(key) {
  key = String(key || '');
  if (!key || key.charAt(0) === '_' || !readLists().hasOwnProperty(key)) fail('list_not_found', 'There is no such list.');
  return key;
}

API['admin.lists.get'] = admin(function () {
  return listsOut_();
});

API['admin.lists.set'] = admin(function (req) {
  saveList(requireList_(req.key), req.values || []);
  return listsOut_();
});

/** A new list: a name, a kind, and the choices to start with (empty, or a copy of another list). */
API['admin.lists.create'] = admin(function (req) {
  var name = String(req.name || '').trim().slice(0, 60);
  if (!name) fail('list_name', 'Give the list a name.');
  var kind = LIST_KINDS_.indexOf(req.kind) === -1 ? 'plain' : req.kind;
  var lists = readLists();
  var info = readListInfo();
  var taken = Object.keys(lists).some(function (k) { return ((info[k] && info[k].name) || BUILTIN_LIST_NAMES_[k] || '').toLowerCase() === name.toLowerCase(); });
  if (taken) fail('list_name_taken', 'Another list has that name.');
  var base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'list';
  var key = base, n = 2;
  while (lists.hasOwnProperty(key) || BUILTIN_LIST_KINDS_.hasOwnProperty(key)) key = base + '_' + n++;
  var values = req.copyOf ? lists[requireList_(req.copyOf)] : [];
  return withLock_(function () {
    saveList(key, values);
    info[key] = { name: name, kind: kind };
    saveListInfo_(info);
    var out = listsOut_();
    out.key = key;
    return out;
  });
});

API['admin.lists.rename'] = admin(function (req) {
  var key = requireList_(req.key);
  var info = readListInfo();
  if (!info[key]) fail('list_builtin', 'The lists that came with the platform keep their names.');
  var name = String(req.name || '').trim().slice(0, 60);
  if (!name) fail('list_name', 'Give the list a name.');
  info[key].name = name;
  saveListInfo_(info);
  return listsOut_();
});

/** Only a list an admin made, and only while no form asks it. */
API['admin.lists.delete'] = admin(function (req) {
  var key = requireList_(req.key);
  if (!readListInfo()[key]) fail('list_builtin', 'The lists that came with the platform cannot be deleted.');
  var users = formsUsingList_(key);
  if (users.length) fail('list_in_use', 'A form still asks this list: ' + users.map(function (f) { return f.title; }).join(', ') + '.');
  withLock_(function () { deleteList_(key); });
  return listsOut_();
});
