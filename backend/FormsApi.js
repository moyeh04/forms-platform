/** Form management for the admin and the public form definition. */

var API = API || {};

API.getForm = function (req) {
  var form = requireForm(String(req.slug || ''));
  var state = Rules.formState(form);
  if (state === 'draft' || state === 'archived') {
    var draft = {
      slug: form.slug,
      type: form.type,
      title: form.title,
      lang: form.lang,
      icon: form.icon,
      messages: form.messages
    };
    Object.assign(draft, FormMetadata.public(form));
    return { state: state, form: draft };
  }
  var out = { state: state, form: publicForm(form), serverTime: nowIso() };
  if (form.type === 'reservation') out.taken = slotAvailability_(form);
  return out;
};

API['admin.forms.list'] = admin(function () {
  return { forms: readForms() };
});

API['admin.forms.get'] = admin(function (req) {
  var form = requireForm(req.id);
  var out = { form: form, lists: readLists(), listInfo: readListInfo() };
  // The timetable editor marks slots that already have bookings.
  if (form.type === 'reservation') {
    out.taken = slotAvailability_(form);
    out.keySources = keyBookingSources_(form).map(function (s) {
      return { id: s.id, title: s.title, term: FormMetadata.slug(s) };
    });
  }
  // The team size and teammates panels count the saved answers that a new range would leave outside.
  if (Rules.fieldByRole(form, 'team_size')) out.teamSizes = teamSizes_(form);
  if (form.type === 'reservation' && Rules.fieldByRole(form, 'members'))
    out.teammateCounts = teammateCounts_(form);
  return out;
});

API['admin.forms.create'] = admin(function (req) {
  return { form: createForm(req) };
});

/** req: id, patch, and base (the `updatedAt` of the copy the page showed, so a newer save is not overwritten). */
API['admin.forms.update'] = admin(function (req) {
  return { form: updateForm(req.id, req.patch || {}, req.base) };
});

API['admin.forms.duplicate'] = admin(function (req) {
  return { form: duplicateForm(req.id, req) };
});

API['admin.forms.delete'] = admin(function (req) {
  var form = requireForm(req.id);
  // The page sends the link name back as a deliberate second key, so a stray call cannot delete a form.
  if (String(req.confirm || '') !== form.slug)
    fail('confirm_required', 'Confirm by sending the form link name.');
  return deleteForm(form.id);
});

function listsOut_() {
  return { lists: readLists(), info: readListInfo() };
}

function requireList_(key) {
  key = String(key || '');
  if (!key || key.charAt(0) === '_' || !readLists().hasOwnProperty(key))
    fail('list_not_found', 'There is no such list.');
  return key;
}

/** A list's name as the admin typed it, cut to length; refused when empty or when another list has it. */
function freeListName_(name, lists, info, self) {
  name = String(name || '')
    .trim()
    .slice(0, 60);
  if (!name) fail('list_name', 'Give the list a name.');
  var taken = Object.keys(lists).some(function (k) {
    return (
      k !== self &&
      (
        (info[k] && info[k].name) ||
        BUILTIN_LIST_NAMES_[k] ||
        ''
      ).toLowerCase() === name.toLowerCase()
    );
  });
  if (taken) fail('list_name_taken', 'Another list has that name.');
  return name;
}

/** A handler that changes the Lists tab: it reads and writes inside the lock, then returns every list. */
function listChange_(change) {
  return admin(function (req) {
    return withLock_(function () {
      var extra = change(req) || {};
      return Object.assign(listsOut_(), extra);
    });
  });
}

API['admin.lists.get'] = admin(function () {
  return listsOut_();
});

API['admin.lists.set'] = listChange_(function (req) {
  saveList(requireList_(req.key), req.values || []);
});

/** A new list: a name, a kind, and the choices to start with (empty, or a copy of another list). */
API['admin.lists.create'] = listChange_(function (req) {
  var lists = readLists();
  var info = readListInfo();
  var name = freeListName_(req.name, lists, info);
  var kind = LIST_KINDS_.indexOf(req.kind) === -1 ? 'plain' : req.kind;
  var base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'list';
  var key = base,
    n = 2;
  while (lists.hasOwnProperty(key) || BUILTIN_LIST_KINDS_.hasOwnProperty(key))
    key = base + '_' + n++;
  saveList(key, req.copyOf ? lists[requireList_(req.copyOf)] : []);
  info[key] = { name: name, kind: kind };
  saveListInfo_(info);
  return { key: key };
});

API['admin.lists.rename'] = listChange_(function (req) {
  var key = requireList_(req.key);
  var info = readListInfo();
  if (!info[key])
    fail(
      'list_builtin',
      'The lists that came with the platform keep their names.'
    );
  info[key].name = freeListName_(req.name, readLists(), info, key);
  saveListInfo_(info);
});

/** Only a list an admin made, and only while no form asks it. */
API['admin.lists.delete'] = listChange_(function (req) {
  var key = requireList_(req.key);
  if (!readListInfo()[key])
    fail(
      'list_builtin',
      'The lists that came with the platform cannot be deleted.'
    );
  var users = formsUsingList_(key);
  if (users.length)
    fail(
      'list_in_use',
      'A form still asks this list: ' +
        users
          .map(function (f) {
            return f.title;
          })
          .join(', ') +
        '.'
    );
  deleteList_(key);
});
