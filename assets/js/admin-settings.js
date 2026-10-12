/** Form settings: everything an admin can change without touching code. */
(function (App) {
  'use strict';

  var ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast, A = App.admin;

  var LOCKED_ROLES = ['name', 'code', 'team_size', 'members', 'slot'];

  function p2(n) { return ('0' + n).slice(-2); }

  function toLocal(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  function fromLocal(v) {
    if (!v) return '';
    var d = new Date(v);
    return isNaN(d) ? '' : d.toISOString();
  }

  // Which sections are open, by form id, so a save (which draws the page again) does not fold them.
  var opened = {};

  /**
   * A settings section folded to one line: its name and what it is set to now.
   * `node.summary` is a function that returns that line; `node.setOpen` unfolds it.
   */
  function panel(title, help) {
    var body = h('div', { class: 'panel-body', hidden: true }, help ? h('p', { class: 'help' }, help) : null, Array.prototype.slice.call(arguments, 2));
    var sum = h('span', { class: 'panel-sum' });
    var head = h('button', { type: 'button', class: 'panel-head', 'aria-expanded': 'false' }, h('span', { class: 'panel-title' }, title), sum);
    var node = h('section', { class: 'panel fold', dataset: { panel: title } }, h('h2', null, head), body);
    node.panelTitle = title;
    node.isOpen = function () { return !body.hidden; };
    node.setOpen = function (open) {
      body.hidden = !open;
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      node.classList.toggle('open', !!open);
      if (node.onToggle) node.onToggle(!!open);
    };
    node.paintSummary = function () { sum.textContent = node.summary ? node.summary() : ''; };
    /** The work area of a tab is always open: it has nothing to fold to. */
    node.pin = function () { node.pinned = true; node.classList.add('pinned'); head.disabled = true; node.setOpen(true); };
    head.addEventListener('click', function () { node.setOpen(body.hidden); });
    return node;
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /** "4C-TH2" belongs to the group "4C": the part before the first dash. */
  function sectionGroup(o) { var v = String(o.value); return v.indexOf('-') > 0 ? v.slice(0, v.indexOf('-')) : 'Other'; }

  /**
   * Chips that limit a form to some values of a list. An empty choice means every value,
   * and choosing every value is stored as the empty choice.
   * opts: name (prefix of the control names), all (text of the "no limit" chip), options,
   * get() and set(values), and optionally groupOf(option) to put the chips under a heading
   * that switches its whole group.
   */
  function allowPicker(opts) {
    var box = h('div', { class: 'allow-picker' });
    var chip = function (name, text, on, click, sub) {
      return h('button', { type: 'button', class: 'toggle-chip', name: name, 'aria-pressed': on ? 'true' : 'false', onclick: function () { click(); paint(); } }, text, sub ? h('span', { class: 'chip-sub', lang: 'ar' }, sub) : null);
    };
    var put = function (values) { opts.set(values.length === opts.options.length ? [] : values); };
    var groups = [];
    opts.options.forEach(function (o) {
      var id = opts.groupOf ? opts.groupOf(o) : '';
      var g = groups.filter(function (x) { return x.id === id; })[0];
      if (!g) groups.push(g = { id: id, options: [] });
      g.options.push(o);
    });
    function paint() {
      var chosen = opts.get();
      var has = function (o) { return chosen.indexOf(String(o.value)) !== -1; };
      ui.clear(box);
      box.appendChild(h('div', { class: 'toggle-chips' }, chip(opts.name + '-all', opts.all, !chosen.length, function () { opts.set([]); })));
      groups.forEach(function (g) {
        var whole = g.options.every(has);
        var values = g.options.map(function (o) { return String(o.value); });
        box.appendChild(h('div', { class: 'toggle-chips', role: 'group', 'aria-label': g.id || opts.all },
          g.id ? chip(opts.name + '-group-' + g.id, 'All ' + g.id, whole, function () {
            var rest = chosen.filter(function (v) { return values.indexOf(v) === -1; });
            put(whole ? rest : rest.concat(values));
          }) : null,
          g.options.map(function (o) {
            var on = has(o);
            return chip(opts.name + '-' + o.value, (o.label && o.label.en) || o.value, on, function () {
              put(on ? chosen.filter(function (v) { return v !== String(o.value); }) : chosen.concat([String(o.value)]));
            }, o.label && o.label.ar && o.label.ar !== o.label.en && o.label.ar !== String(o.value) ? o.label.ar : null);
          })));
      });
    }
    paint();
    return box;
  }

  A.views.settings = async function (mount, slug, startTab) {
    var res = await A.call('admin.forms.get', { id: slug });
    var f = res.form;
    f.lang = f.lang || { default: 'en', allowSwitch: true };
    f.editKey = f.editKey || { enabled: true, days: 7, allowEdit: true, allowDelete: true };
    f.rules = f.rules || {};
    f.notifications = f.notifications || {};
    f.review = f.review || { steps: [] };
    var metadata = FormMetadata.read(f);

    var t = A.TYPES[f.type] || { label: f.type };
    var link = A.formLink(f.slug);
    var hasSize = !!Rules.fieldByRole(f, 'team_size');
    var hasDrive = (f.fields || []).some(function (x) { return x.type === 'drive_link'; });
    var isTeam = f.type === 'team_registration' || f.type === 'task_submission';
    var isReservation = f.type === 'reservation';
    var reservationMembers = Rules.fieldByRole(f, 'members');

    ui.clear(mount);
    // Status is the setting changed most often, so it is in the header of every tab.
    var statusSel = A.select(f.status, [['draft', 'Draft (hidden)'], ['open', 'Open'], ['closed', 'Closed'], ['archived', 'Archived']], function (v) { f.status = v; });
    statusSel.name = 'status';
    mount.appendChild(h('div', { class: 'page-head' },
      h('h2', null, f.title), A.termTags(f), h('span', { class: 'muted-note' }, t.label),
      h('label', { class: 'status-pick' }, h('span', { class: 'tool-label' }, 'Status'), statusSel),
      h('a', { class: 'btn btn-quiet sm', href: link, target: '_blank', rel: 'noopener' }, 'Open form'),
      h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: async function () { toast((await ui.copyText(link)) ? 'Form link copied' : 'Could not copy', 'ok'); } }, icon('link', 18), 'Copy link')));

    /* General ---------------------------------------------------- */
    var general = panel('Name and dates', 'Students can only submit while the status is Open and the current time is inside the dates below.',
      A.field('Title', A.text(f.title, function (v) { f.title = v; }, { name: 'title' }), 'The heading students see.'),
      A.metadataEditor(f.type, metadata, function (v) { Object.assign(metadata, v); }),
      A.field('Link name', A.text(f.slug, function (v) { f.slug = v; }, { name: 'slug', dir: 'ltr' }), 'The form address ends with ?f= and this name. Changing it breaks links already shared.'),
      h('div', { class: 'row' },
        A.field('Opens at', h('input', { class: 'input', type: 'datetime-local', name: 'opensAt', value: toLocal(f.opensAt), onchange: function (e) { f.opensAt = fromLocal(e.target.value); } }), 'Leave empty to open as soon as the status is Open.'),
        A.field('Closes at', h('input', { class: 'input', type: 'datetime-local', name: 'closesAt', value: toLocal(f.closesAt), onchange: function (e) { f.closesAt = fromLocal(e.target.value); } }), 'Leave empty to stay open until you close it.')),
      h('div', { class: 'row' },
        A.field('Form language', A.select(f.lang.default, [['en', 'English'], ['ar', 'Arabic']], function (v) { f.lang.default = v; })),
        A.field('Header icon', A.select(f.icon || 'none', [['team', 'Team'], ['calendar', 'Calendar'], ['task', 'Task'], ['chat', 'Chat'], ['none', 'None']], function (v) { f.icon = v; })),
        h('div', { class: 'field-row' }, A.check('Show the language switch to students', f.lang.allowSwitch !== false, function (v) { f.lang.allowSwitch = v; }))));

    general.summary = function () {
      var when = function (iso) { return toLocal(iso).replace('T', ' '); };
      return [f.title, f.opensAt ? 'opens ' + when(f.opensAt) : '', f.closesAt ? 'closes ' + when(f.closesAt) : ''].filter(Boolean).join(' · ');
    };

    /* Who can register --------------------------------------------- */
    var majorsPanel = null;
    var label = function (o) { return (o.label && o.label.en) || o.value; };
    var limited = function (list) { return (f.fields || []).some(function (x) { return (x.list === list && x.enabled !== false) || (x.fields || []).some(function (y) { return y.list === list && y.enabled !== false; }); }); };
    var majorOptions = limited('majors') ? (res.lists && res.lists.majors) || [] : [];
    var sectionOptions = limited('sections') ? (res.lists && res.lists.sections) || [] : [];
    if (majorOptions.length || sectionOptions.length) {
      var whoBody = [];
      if (majorOptions.length) {
        f.rules.majors = Array.isArray(f.rules.majors) ? f.rules.majors.slice() : [];
        var majorNote = h('p', { class: 'muted-note' });
        var paintMajorNote = function () {
          var names = majorOptions.filter(function (o) { return f.rules.majors.indexOf(String(o.value)) !== -1; }).map(label);
          majorNote.textContent = !names.length ? 'Students of every specialization can register.'
            : names.length === 1 ? 'Only ' + names[0] + ' students can register. The Major question is filled in for them and locked.'
            : 'Only ' + names.join(' and ') + ' students can register.';
        };
        whoBody.push(h('h3', null, 'Specializations'), h('p', { class: 'help' }, 'The choices come from the Majors list. Students of other specializations cannot submit.'),
          allowPicker({ name: 'major', all: 'All specializations', options: majorOptions, get: function () { return f.rules.majors; }, set: function (v) { f.rules.majors = v; paintMajorNote(); } }), majorNote);
        paintMajorNote();
      }
      if (sectionOptions.length) {
        f.rules.sections = Array.isArray(f.rules.sections) ? f.rules.sections.slice() : [];
        var sectionNote = h('p', { class: 'muted-note' });
        var paintSectionNote = function () {
          sectionNote.textContent = f.rules.sections.length ? 'Students choose from ' + plural(f.rules.sections.length, 'section', 'sections') + '. The other sections are not offered and are refused.' : 'Students choose from every section in the Sections list.';
        };
        whoBody.push(h('h3', null, 'Sections'), h('p', { class: 'help' }, 'Pick the sections this form is for; they can be from more than one year. A group is the part of the name before the dash (4C, 3L). ', h('a', { href: '#/lists' }, 'Add or rename sections in Lists.')),
          allowPicker({ name: 'section', all: 'All sections', options: sectionOptions, groupOf: sectionGroup, get: function () { return f.rules.sections; }, set: function (v) { f.rules.sections = v; paintSectionNote(); } }), sectionNote);
        paintSectionNote();
      }
      majorsPanel = panel('Who can register', 'Limit this form to some students. With no limit, every choice of the list is offered.', whoBody);
      majorsPanel.summary = function () {
        var parts = [];
        if (majorOptions.length && f.rules.majors.length) parts.push('Only ' + majorOptions.filter(function (o) { return f.rules.majors.indexOf(String(o.value)) !== -1; }).map(label).join(', '));
        if (sectionOptions.length && f.rules.sections.length) {
          var groups = [];
          f.rules.sections.forEach(function (v) { var g = sectionGroup({ value: v }); if (groups.indexOf(g) === -1) groups.push(g); });
          parts.push(plural(f.rules.sections.length, 'section', 'sections') + ' (' + groups.join(', ') + ')');
        }
        return parts.length ? parts.join(' · ') : 'Everyone';
      };
    }

    /* Reservation teammates ------------------------------------- */
    /* Booking with a key: the student types a registration key instead of the answers */
    var keyBookPanel = null;
    if (isReservation) {
      var sources = res.keySources || [];
      f.keyBooking = f.keyBooking || { enabled: false, source: '' };
      var kbBody = h('div');
      var paintKb = function () {
        ui.clear(kbBody);
        // Without a form that issues keys there is nothing to switch on, so the switch is not shown.
        if (!sources.length) return kbBody.appendChild(h('p', { class: 'muted-note' }, 'No form gives its students a key yet. Create a team registration form first, then come back here.'));
        var known = sources.some(function (s) { return s.id === f.keyBooking.source; });
        kbBody.appendChild(A.check('Students book with the key from their registration', f.keyBooking.enabled, function (v) {
          f.keyBooking.enabled = v;
          if (v && !known) f.keyBooking.source = sources[0].id;
          paintKb();
        }, false, 'keyBooking'));
        if (!f.keyBooking.enabled) return;
        if (!known) {
          kbBody.appendChild(h('p', { class: 'error', role: 'alert' }, 'The registration form this used no longer gives keys. Choose another one.'));
          f.keyBooking.source = sources[0].id;
        }
        var pick = A.select(f.keyBooking.source, sources.map(function (s) { return [s.id, s.title + (s.term ? ' (' + s.term + ')' : '')]; }), function (v) { f.keyBooking.source = v; });
        pick.name = 'keySource';
        kbBody.appendChild(A.field('Registration form', pick, 'The student types the 5-digit key from that form, checks the team shown, and picks a slot.'));
        kbBody.appendChild(h('ul', { class: 'help plain-list' },
          h('li', null, 'Name, code, phone and every other question the two forms share are copied from the registration. Students are not asked them again.'),
          h('li', null, 'The Questions section below still decides which answers are kept and shown.'),
          h('li', null, 'The same key opens and cancels the booking. A key that has expired for editing still books.'),
          h('li', null, 'Each team books once.')));
      };
      paintKb();
      keyBookPanel = panel('Booking with a key', 'Let teams that already registered book a slot without typing their details again.', kbBody);
      keyBookPanel.summary = function () {
        var from = sources.filter(function (x) { return x.id === f.keyBooking.source; })[0];
        return f.keyBooking.enabled ? 'On' + (from ? ', keys of ' + from.title : ', no form chosen') : 'Off';
      };
    }

    var teammatePanel = null;
    if (isReservation && reservationMembers) {
      teammatePanel = panel('Teammates', 'Optionally collect the names and details of the other people attending with the team leader.',
        A.check('Ask for teammates', reservationMembers.enabled !== false, function (enabled) {
          reservationMembers.enabled = enabled;
        }, false, 'reservation-members'));
    }

    /* Team size -------------------------------------------------- */
    var sizePanel = null;
    if (hasSize) {
      f.rules.teamSize = f.rules.teamSize || { min: 1, max: 6 };
      var preview = h('div', { class: 'size-preview', 'aria-live': 'polite' });
      var paintPreview = function () {
        var min = parseInt(f.rules.teamSize.min, 10), max = parseInt(f.rules.teamSize.max, 10);
        ui.clear(preview);
        if (!(min >= 1) || !(max >= min) || max > 20) return preview.appendChild(h('span', { class: 'muted-note' }, 'Enter a minimum of at least 1 and a maximum that is not lower, up to 20.'));
        preview.appendChild(h('span', { class: 'muted-note' }, 'Students will choose from: '));
        for (var n = min; n <= max; n++) preview.appendChild(h('span', { class: 'num-chip' }, String(n)));
      };
      // A note shown to students who pick certain sizes, e.g. "others will be added to reach 5".
      var notice = f.rules.teamSize.notice = f.rules.teamSize.notice || { sizes: [], text: { en: '', ar: '' } };
      notice.text = notice.text || { en: '', ar: '' };
      var noticeChips = h('div', { class: 'toggle-chips', role: 'group', 'aria-label': 'Show the note for these team sizes' });
      var noticePreview = h('div', { class: 'notice-preview', 'aria-live': 'polite' });
      var paintNotice = function () {
        var min = parseInt(f.rules.teamSize.min, 10), max = parseInt(f.rules.teamSize.max, 10);
        ui.clear(noticeChips);
        ui.clear(noticePreview);
        if (!(min >= 1) || !(max >= min) || max > 20) return;
        notice.sizes = notice.sizes.filter(function (n) { return n >= min && n <= max; });
        for (var n = min; n <= max; n++) (function (n) {
          var on = notice.sizes.indexOf(n) !== -1;
          noticeChips.appendChild(h('button', { type: 'button', class: 'toggle-chip', name: 'notice-size-' + n, 'aria-pressed': on ? 'true' : 'false', onclick: function () {
            notice.sizes = on ? notice.sizes.filter(function (x) { return x !== n; }) : notice.sizes.concat([n]).sort(function (a, b) { return a - b; });
            paintNotice();
          } }, String(n)));
        })(n);
        var sample = notice.sizes[0];
        var text = sample ? Rules.teamSizeNotice({ rules: { teamSize: { min: min, max: max, notice: notice } } }, sample, 'en') : '';
        if (!notice.sizes.length) noticePreview.appendChild(h('span', { class: 'muted-note' }, 'Pick one or more sizes above to show the note.'));
        else if (!text) noticePreview.appendChild(h('span', { class: 'muted-note' }, 'Write the note below.'));
        else noticePreview.appendChild(h('div', null, h('span', { class: 'muted-note' }, 'A student who picks ' + sample + ' sees:'), h('p', { class: 'size-notice' }, icon('info', 18), h('span', null, text))));
      };
      var paintBoth = function () { paintPreview(); paintNotice(); };
      sizePanel = panel('Team size', 'Students must say how many people are in the team, then fill in exactly that many member forms. The number counts the leader, so a team of 1 works alone.',
        h('div', { class: 'row' },
          A.field('Minimum team size', A.number(f.rules.teamSize.min, function (v) { f.rules.teamSize.min = v; paintBoth(); }, { name: 'teamMin', min: '1', max: '20' })),
          A.field('Maximum team size', A.number(f.rules.teamSize.max, function (v) { f.rules.teamSize.max = v; paintBoth(); }, { name: 'teamMax', min: '1', max: '20' }))),
        preview,
        h('div', { class: 'subpanel' },
          h('h3', null, 'Note for some team sizes'),
          h('p', { class: 'help' }, 'Show a short note when a student picks one of the sizes you switch on, for example to say that other students will be added to small teams. Write {n} for the size they picked and {max} for the largest size.'),
          h('span', { class: 'label' }, 'Show the note for teams of'),
          noticeChips,
          h('div', { class: 'desc-pair' },
            A.field('Note in English', h('textarea', { class: 'textarea', rows: '2', name: 'noticeEn', placeholder: 'Other students will be added to your team to reach {max}.', oninput: function (e) { notice.text.en = e.target.value; paintNotice(); } }, notice.text.en || '')),
            A.field('Note in Arabic', h('textarea', { class: 'textarea', rows: '2', name: 'noticeAr', dir: 'rtl', lang: 'ar', placeholder: 'هيتضاف طلاب تانيين لفريقك لحد ما يبقى {max}.', oninput: function (e) { notice.text.ar = e.target.value; } }, notice.text.ar || ''))),
          noticePreview));
      paintBoth();
    }

    /* Edit key --------------------------------------------------- */
    var keyPanel = panel('Edit key', 'Each student gets a 5-digit key on the success page and by email. The key alone opens their registration.',
      h('div', { class: 'row' },
        h('div', { class: 'field-row' }, A.check('Give students an edit key', f.editKey.enabled, function (v) { f.editKey.enabled = v; })),
        A.field('Key works for (days)', A.number(f.editKey.days, function (v) { f.editKey.days = parseInt(v, 10) || 7; }, { name: 'keyDays', min: '1', max: '90' }))),
      h('div', { class: 'row' },
        h('div', { class: 'field-row' }, A.check('Students may change their answers', f.editKey.allowEdit, function (v) { f.editKey.allowEdit = v; })),
        h('div', { class: 'field-row' }, A.check('Students may cancel their registration', f.editKey.allowDelete, function (v) { f.editKey.allowDelete = v; }))));

    /* Rules ------------------------------------------------------ */
    var hasFolder = (f.fields || []).some(function (x) { return x.type === 'drive_link' && (!x.kinds || x.kinds.indexOf('folder') !== -1); });
    f.rules.folderName = f.rules.folderName || { enabled: false, subject: '' };
    var folderBox = hasFolder ? h('div', { class: 'subpanel' },
      h('h3', null, 'Drive folder name'),
      h('p', { class: 'help' }, 'When the Drive check is on, the folder name is read and must look like Team_Leader_Name_Project_Name_Subject_Name, for example Ahmed_Mohamed_Library_System_Software_Engineering: no spaces, parts joined by underscores, ending with the subject name. Students see the rule with an example.'),
      A.check('Folder names must follow Team_Leader_Name_Project_Name_Subject_Name', f.rules.folderName.enabled, function (v) { f.rules.folderName.enabled = v; }),
      A.field('Subject name at the end', A.text(f.rules.folderName.subject || '', function (v) { f.rules.folderName.subject = Rules.folderPart(v); }, { name: 'folderSubject', dir: 'ltr', placeholder: 'Software_Engineering' }), 'The subject name, not the code. Spaces become underscores. Leave empty to accept any subject name.')) : null;
    var rulesPanel = panel('Limits and checks', null,
      h('div', { class: 'row' },
        A.field('Maximum submissions', A.number(f.rules.maxSubmissions == null ? '' : f.rules.maxSubmissions, function (v) { f.rules.maxSubmissions = v === '' ? null : parseInt(v, 10); }, { name: 'maxSubmissions', min: '1' }), 'Leave empty for no limit.'),
        hasDrive ? A.field('Google Drive links', A.select(f.rules.driveCheck || 'strict', [['strict', 'Must open and be shared with anyone who has the link'], ['off', 'Do not check']], function (v) { f.rules.driveCheck = v; })) : null),
      isTeam ? A.check('A student may appear in only one team of this form', f.rules.uniqueAcrossForm, function (v) { f.rules.uniqueAcrossForm = v; }) : null,
      folderBox);
    var emailPanel = panel('Emails', 'Emails go out from your Google account. Students always see their key on the success page, and you can look any key up under Responses, Details.',
      A.check('Send each student a confirmation email with their reference and key', f.notifications.confirmEmail !== false, function (v) { f.notifications.confirmEmail = v; }, false, 'confirmEmail'),
      h('p', { class: 'muted-note' }, 'Turned off, nothing is emailed to students. If you do not need their email address at all, also untick Show for the Email question above.'),
      A.field('Email me a note for every new submission', A.text(f.notifications.alertEmail || '', function (v) { f.notifications.alertEmail = v.trim(); }, { name: 'alertEmail', type: 'email', placeholder: 'you@example.com' }), 'Optional. Leave empty for no alerts.'));

    /* Fields ----------------------------------------------------- */
    var rows = [];
    var qList = h('div', { class: 'q-list' });
    var toolsOpen = {};
    // Questions that belong to a page for a reason: the member forms follow the size, and a booking is its own page.
    var FIXED_ROLES = ['team_size', 'members', 'slot'];
    var KINDS = [['text', 'Short answer'], ['textarea', 'Long answer'], ['select', 'One choice from a list']];
    function hasHelp(fd) { return !!(fd.help && ((fd.help.en || '').trim() || (fd.help.ar || '').trim())); }
    function pageName(st) { return (st.title && (st.title.en || st.title.ar)) || 'Page with no title'; }
    function pageOf(fd) { return (f.steps || []).filter(function (st) { return (st.fields || []).indexOf(fd.id) !== -1; })[0] || null; }
    function moveToPage(fd, id) {
      var from = pageOf(fd);
      if (from) from.fields = from.fields.filter(function (x) { return x !== fd.id; });
      var to = f.steps.filter(function (st) { return st.id === id; })[0];
      to.fields = (to.fields || []).concat([fd.id]);
      paintQuestions();
    }
    function shift(fd, by) {
      var list = pageOf(fd).fields;
      var at = list.indexOf(fd.id), to = at + by;
      if (to < 0 || to >= list.length) return;
      list.splice(at, 1); list.splice(to, 0, fd.id);
      paintQuestions();
    }
    function addQuestion(st) {
      var id = 'q_' + Math.random().toString(36).slice(2, 10);
      var fd = { id: id, type: 'text', custom: true, label: { en: '', ar: '' }, required: false, enabled: true };
      f.fields.push(fd);
      st.fields = (st.fields || []).concat([id]);
      toolsOpen[id] = true;
      paintQuestions();
      var input = qList.querySelector('[data-field="' + id + '"] input[type="text"]');
      if (input && input.focus) input.focus();
    }
    function removeQuestion(fd) {
      f.fields = f.fields.filter(function (x) { return x !== fd; });
      (f.steps || []).forEach(function (st) { st.fields = (st.fields || []).filter(function (x) { return x !== fd.id; }); });
      paintQuestions();
    }
    /** The heading of a page: its number, its title in both languages, its place among the pages, and Remove while it is empty. */
    function pageHead(st, n) {
      st.title = st.title || { en: st.id, ar: st.id };
      var empty = !(st.fields || []).length;
      var move = function (by) { f.steps.splice(n, 1); f.steps.splice(n + by, 0, st); paintQuestions(); };
      return h('div', { class: 'q-page', dataset: { page: st.id } },
        h('span', { class: 'tt-num' }, String(n + 1)),
        h('div', { class: 'q-labels' },
          A.text(st.title.en, function (v) { st.title.en = v; }, { name: 'page-title-en-' + st.id, 'aria-label': 'English title of page ' + (n + 1), placeholder: 'Page title, in English' }),
          A.text(st.title.ar, function (v) { st.title.ar = v; }, { name: 'page-title-ar-' + st.id, 'aria-label': 'Arabic title of page ' + (n + 1), dir: 'rtl', lang: 'ar', placeholder: 'عنوان الصفحة' })),
        h('div', { class: 'q-opts' },
          h('button', { type: 'button', class: 'icon-btn sm', name: 'page-up-' + st.id, 'aria-label': 'Move page ' + (n + 1) + ' up', disabled: n === 0, onclick: function () { move(-1); } }, '↑'),
          h('button', { type: 'button', class: 'icon-btn sm', name: 'page-down-' + st.id, 'aria-label': 'Move page ' + (n + 1) + ' down', disabled: n === f.steps.length - 1, onclick: function () { move(1); } }, '↓'),
          // A page is removed only when nothing is on it, so removing a page never removes a question.
          empty && f.steps.length > 1 ? h('button', { type: 'button', class: 'btn btn-quiet sm danger', name: 'remove-page-' + st.id, onclick: function () { f.steps.splice(n, 1); paintQuestions(); } }, icon('trash', 16), 'Remove page') : null));
    }
    function addPage() {
      var st = { id: 'p_' + Math.random().toString(36).slice(2, 10), custom: true, title: { en: '', ar: '' }, fields: [] };
      f.steps = (f.steps || []).concat([st]);
      paintQuestions();
      var input = qList.querySelector('[name="page-title-en-' + st.id + '"]');
      if (input && input.focus) input.focus();
    }
    /** "Yes" or "Yes | نعم" on each line. */
    function readChoices(text) {
      return String(text || '').split('\n').map(function (line) {
        var parts = line.split('|').map(function (x) { return x.trim(); });
        return parts[0] ? { value: parts[0], label: { en: parts[0], ar: parts[1] || parts[0] } } : null;
      }).filter(Boolean);
    }
    /** Where the question is, and for an added question what kind it is. Folded until asked for, to keep the list short. */
    function toolsRow(fd) {
      var page = pageOf(fd);
      var movable = FIXED_ROLES.indexOf(fd.role) === -1 && (f.steps || []).length > 1 && page;
      if (!movable && !fd.custom) return null;
      var list = page ? page.fields : [];
      var pageSel = movable ? A.select(page.id, f.steps.map(function (st, n) { return [st.id, (n + 1) + '. ' + pageName(st)]; }), function (v) { moveToPage(fd, v); }) : null;
      if (pageSel) pageSel.name = 'page-' + fd.id;
      var kindSel = fd.custom ? A.select(fd.type, KINDS, function (v) { fd.type = v; if (v !== 'select') delete fd.options; paintQuestions(); }) : null;
      if (kindSel) kindSel.name = 'kind-' + fd.id;
      var choices = fd.custom && fd.type === 'select' ? h('label', { class: 'field-row q-choices' }, h('span', { class: 'label' }, 'Choices, one on each line'),
        h('textarea', { class: 'textarea', rows: '4', name: 'choices-' + fd.id, placeholder: 'Yes\nNo\nTo add the Arabic text: Yes | نعم', oninput: function (e) { fd.options = readChoices(e.target.value); } },
          (fd.options || []).map(function (o) { return o.label.ar && o.label.ar !== o.label.en ? o.label.en + ' | ' + o.label.ar : o.label.en; }).join('\n'))) : null;
      return h('div', { class: 'q-tools', dataset: { tools: fd.id }, hidden: !toolsOpen[fd.id] },
        pageSel ? h('label', { class: 'q-tool' }, h('span', { class: 'tool-label' }, 'Page'), pageSel) : null,
        movable ? h('span', { class: 'q-tool' }, h('span', { class: 'tool-label' }, 'Order'),
          h('button', { type: 'button', class: 'icon-btn sm', name: 'up-' + fd.id, 'aria-label': 'Move up', disabled: list.indexOf(fd.id) === 0, onclick: function () { shift(fd, -1); } }, '↑'),
          h('button', { type: 'button', class: 'icon-btn sm', name: 'down-' + fd.id, 'aria-label': 'Move down', disabled: list.indexOf(fd.id) === list.length - 1, onclick: function () { shift(fd, 1); } }, '↓')) : null,
        kindSel ? h('label', { class: 'q-tool' }, h('span', { class: 'tool-label' }, 'Kind of answer'), kindSel) : null,
        fd.custom ? h('button', { type: 'button', class: 'btn btn-quiet sm danger', name: 'remove-' + fd.id, title: 'Answers already given stay in the Google Sheet but are no longer shown.', onclick: function () { removeQuestion(fd); } }, icon('trash', 16), 'Remove question') : null,
        choices);
    }
    function fieldRow(fd, sub) {
      var locked = LOCKED_ROLES.indexOf(fd.role) !== -1;
      // The description stays hidden until it has text or the admin asks for it.
      var descRow = h('div', { class: 'q-desc' + (sub ? ' sub' : ''), dataset: { desc: fd.id }, hidden: !hasHelp(fd) },
        h('span', { class: 'label' }, 'Description students see under this question'),
        h('div', { class: 'desc-pair' },
          h('textarea', { class: 'textarea', rows: '2', name: 'help-en-' + fd.id, 'aria-label': 'English description for ' + fd.id, placeholder: 'English, for example: In case of 3 or 4, other students will be added to reach 5', oninput: function (e) { fd.help = Object.assign({}, fd.help, { en: e.target.value }); } }, (fd.help && fd.help.en) || ''),
          h('textarea', { class: 'textarea', rows: '2', name: 'help-ar-' + fd.id, 'aria-label': 'Arabic description for ' + fd.id, dir: 'rtl', lang: 'ar', placeholder: 'بالعربي', oninput: function (e) { fd.help = Object.assign({}, fd.help, { ar: e.target.value }); } }, (fd.help && fd.help.ar) || '')),
        h('button', { type: 'button', class: 'link-btn', onclick: function () { fd.help = { en: '', ar: '' }; descRow.querySelectorAll('textarea').forEach(function (t) { t.value = ''; }); descRow.hidden = true; descBtn.hidden = false; } }, 'Remove description'));
      var descBtn = h('button', { type: 'button', class: 'link-btn add-desc', name: 'desc-' + fd.id, hidden: hasHelp(fd), onclick: function () {
        descRow.hidden = false; descBtn.hidden = true;
        var first = descRow.querySelector('textarea'); if (first) first.focus();
      } }, '+ Description');
      var tools = sub ? null : toolsRow(fd);
      var toolsBtn = tools ? h('button', { type: 'button', class: 'link-btn add-desc', name: 'tools-' + fd.id, 'aria-expanded': toolsOpen[fd.id] ? 'true' : 'false', onclick: function () {
        toolsOpen[fd.id] = tools.hidden; tools.hidden = !tools.hidden; toolsBtn.setAttribute('aria-expanded', tools.hidden ? 'false' : 'true');
      } }, fd.custom ? 'Page and kind' : 'Page') : null;
      var kind = (KINDS.filter(function (k) { return fd.custom && k[0] === fd.type; })[0] || [])[1];
      var row = h('div', { class: 'q-row' + (sub ? ' sub' : '') + (fd.custom ? ' custom' : ''), dataset: { field: fd.id } },
        h('div', { class: 'q-show' }, A.check('Show', fd.enabled !== false, function (v) { fd.enabled = v; row.classList.toggle('off', !v); }, locked)),
        h('div', { class: 'q-labels' },
          A.text(fd.label.en, function (v) { fd.label.en = v; }, { 'aria-label': 'English label for ' + fd.id, placeholder: fd.custom ? 'Your question, in English' : null }),
          A.text(fd.label.ar, function (v) { fd.label.ar = v; }, { 'aria-label': 'Arabic label for ' + fd.id, dir: 'rtl', lang: 'ar', placeholder: fd.custom ? 'السؤال بالعربي' : null })),
        h('div', { class: 'q-opts' },
          A.check('Required', fd.required !== false, function (v) { fd.required = v; }, locked),
          fd.type === 'arabic_name' ? h('label', { class: 'q-parts' }, A.number(fd.minParts || 4, function (v) { fd.minParts = parseInt(v, 10) || 4; }, { class: 'input num', min: '2', max: '6', 'aria-label': 'Name parts for ' + fd.id }), 'name parts') : h('span', { class: 'q-type' }, kind ? 'added · ' + kind.toLowerCase() : fd.type.replace('_', ' ')),
          descBtn, toolsBtn));
      if (fd.enabled === false) row.classList.add('off');
      rows.push(row, descRow, tools);
      if (fd.type === 'members') (fd.fields || []).forEach(function (sf) { fieldRow(sf, true); });
    }
    // Questions are listed under the page of the form that shows them, in the order students meet them.
    function paintQuestions() {
      rows = [];
      var listed = (f.fields || []).filter(function (fd) { return !(isReservation && fd.role === 'members'); });
      var placed = {};
      (f.steps || []).forEach(function (st, n) {
        var mine = (st.fields || []).map(function (id) { return listed.filter(function (fd) { return fd.id === id; })[0]; }).filter(Boolean);
        rows.push(pageHead(st, n));
        mine.forEach(function (fd) { placed[fd.id] = true; fieldRow(fd, false); });
        if (!mine.length) rows.push(h('p', { class: 'muted-note q-empty' }, 'This page has no questions yet. Students do not see a page with no questions.'));
        rows.push(h('button', { type: 'button', class: 'btn btn-quiet sm q-add', name: 'add-question-' + st.id, onclick: function () { addQuestion(st); } }, icon('plus', 16), 'Add a question to this page'));
      });
      var loose = listed.filter(function (fd) { return !placed[fd.id]; });
      if (loose.length && (f.steps || []).length) rows.push(h('h3', { class: 'q-page', dataset: { page: '' } }, 'Not on a page (students do not see these)'));
      loose.forEach(function (fd) { fieldRow(fd, false); });
      rows.push(h('button', { type: 'button', class: 'btn btn-quiet q-add-page', name: 'add-page', onclick: addPage }, icon('plus', 18), 'Add a page'));
      ui.clear(qList);
      rows.forEach(function (n) { if (n) qList.appendChild(n); });
    }
    paintQuestions();
    var fieldsPanel = panel('Questions', 'Each page of the form and its questions, in the order students see them. Rename a page, add a page, or move a question to another page with Page. Rename a question, hide it, make it required, or give it a description. Add your own questions to any page. Team size, names, codes, and the booking slot are always required. For names, the number is how many name parts are needed (4 means a four-part name).',
      qList);
    fieldsPanel.summary = function () {
      var all = [];
      (f.fields || []).forEach(function (fd) { if (!(isReservation && fd.role === 'members')) all.push(fd); });
      var hidden = all.filter(function (fd) { return fd.enabled === false; }).length;
      return (all.length - hidden) + ' shown' + (hidden ? ', ' + hidden + ' hidden' : '');
    };

    /* Slots: session hours once, then a grid of days and times ---- */
    var slotsPanel = null;
    if (f.type === 'reservation') {
      f.slots = f.slots || { days: [], capacity: 1 };
      var pat = f.slots.pattern = Object.assign({ start: '12:30', end: '15:30', length: 20, gap: 5 }, f.slots.pattern || {});
      var patternTimes = function () { return Rules.generateSlots({ start: pat.start, end: pat.end, length: pat.length, gap: pat.gap }); };
      var autoLabel = function (date) {
        return Rules.dayLabel(date);
      };
      var addDays = function (date, n) {
        var d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n);
        return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
      };
      f.slots.days.forEach(function (d) { d._auto = !d.label || d.label === autoLabel(d.date); });
      var taken = res.taken || {};

      /* Step 1: session hours */
      var patPreview = h('div', { class: 'pattern-preview', 'aria-live': 'polite' });
      var paintPattern = function () {
        ui.clear(patPreview);
        var times = patternTimes();
        if (!times.length) return patPreview.appendChild(h('p', { class: 'error' }, 'These hours make no slots. The last slot must end after the first one starts.'));
        patPreview.appendChild(h('p', { class: 'muted-note' }, times.length + ' slot' + (times.length > 1 ? 's' : '') + ' a day, from ' + times[0].split(' - ')[0] + ' to ' + times[times.length - 1].split(' - ')[1] + '.'));
        patPreview.appendChild(h('div', { class: 'time-chips pattern-chips' }, times.map(function (tm) { return h('span', { class: 'time-chip' }, tm); })));
      };
      // The grid's rows come from these hours, so it follows every change to them.
      var hoursChanged = function () { paintPattern(); if (paintDays) paintDays(); };
      var quick = function (key, values, unit) {
        var box = h('div', { class: 'toggle-chips', role: 'radiogroup' });
        var input = h('input', { class: 'input num', type: 'number', min: '0', max: '240', name: 'pattern-' + key, value: String(pat[key]), 'aria-label': key === 'length' ? 'Minutes per slot' : 'Minutes between slots', oninput: function (e) { pat[key] = parseInt(e.target.value, 10) || 0; paint(); hoursChanged(); } });
        function paint() {
          ui.clear(box);
          values.forEach(function (v) {
            var on = Number(pat[key]) === v;
            box.appendChild(h('button', { type: 'button', class: 'toggle-chip sm', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'aria-pressed': on ? 'true' : 'false', onclick: function () { pat[key] = v; input.value = String(v); paint(); hoursChanged(); } }, v + unit));
          });
          box.appendChild(input);
        }
        paint();
        return box;
      };
      var capVal = h('output', { class: 'stepper-val', name: 'capacity' }, String(f.slots.capacity || 1));
      var step = function (d) { f.slots.capacity = Math.max(1, Math.min(50, (f.slots.capacity || 1) + d)); capVal.textContent = String(f.slots.capacity); };
      // Shown only while some day differs from the session hours, so it always has something to do.
      var applyBox = h('div', { class: 'tt-apply' });
      var paintApply = function () {
        ui.clear(applyBox);
        if (!patternDiffers()) return;
        applyBox.appendChild(h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'apply-all', onclick: function () {
          var times = patternTimes();
          f.slots.days.forEach(function (d) { d.times = times.slice(); });
          paintDays(); toast('Every day now uses these hours. Save to keep it.', 'ok');
        } }, 'Use these hours for every day'));
        applyBox.appendChild(h('span', { class: 'muted-note' }, 'Some days have different times.'));
      };
      var hoursCard = h('div', { class: 'tt-step' },
        h('div', { class: 'tt-step-head' }, h('span', { class: 'tt-num' }, '1'), h('div', null, h('h3', null, 'Session hours'), h('p', { class: 'help' }, 'New days start with these slots. You can still change any single day below.'))),
        h('div', { class: 'tt-hours' },
          A.field('First slot starts', h('input', { class: 'input', type: 'time', name: 'pattern-start', value: pat.start, oninput: function (e) { pat.start = e.target.value; hoursChanged(); } })),
          A.field('Last slot ends by', h('input', { class: 'input', type: 'time', name: 'pattern-end', value: pat.end, oninput: function (e) { pat.end = e.target.value; hoursChanged(); } })),
          h('div', { class: 'field-row tt-wide' }, h('span', { class: 'label' }, 'Each slot'), quick('length', [10, 15, 20, 30], ' min')),
          h('div', { class: 'field-row tt-wide' }, h('span', { class: 'label' }, 'Break between'), quick('gap', [0, 5, 10], ' min'))),
        patPreview,
        applyBox);

      var capCard = h('div', { class: 'tt-capacity' },
        h('div', null, h('h3', null, 'Bookings per slot'), h('p', { class: 'help' }, 'How many teams can book the same time. With 2, a slot stays open until two teams have booked it.')),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', class: 'icon-btn sm', name: 'capacity-down', 'aria-label': 'Fewer bookings per slot', onclick: function () { step(-1); } }, '−'),
          capVal,
          h('button', { type: 'button', class: 'icon-btn sm', name: 'capacity-up', 'aria-label': 'More bookings per slot', onclick: function () { step(1); } }, '+')));

      /* Step 2: days as a grid. A range adds many at once; one day at a time opens for its date, name and odd times. */
      var daysBox = h('div', { class: 'tt-days' });
      var iso = function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
      var slotStart = function (tm) {
        // "1:15 - 1:35" is after "12:55": hours below 8 are read as afternoon.
        var m = String(tm).match(/^(\d{1,2}):(\d{2})/); if (!m) return 0;
        var hh = parseInt(m[1], 10); if (hh < 8) hh += 12;
        return hh * 60 + parseInt(m[2], 10);
      };
      var newDay = function (date, times) {
        return { label: autoLabel(date), date: date || '', times: times, _auto: true };
      };
      var needsWork = function (d) { return !String(d.label || '').trim() || !d.times.length; };
      var patternDiffers = function () {
        var times = patternTimes().join('|');
        return !!times && f.slots.days.some(function (d) { return d.times.join('|') !== times; });
      };
      // One day is open for editing at a time; the grid shows all of them.
      var select = function (day) { f.slots.days.forEach(function (d) { d._open = d === day; }); };
      var bookedIn = function (d, tm) { return d.id ? (taken[Rules.slotKey(d.id, tm)] || 0) : 0; };
      var rowTimes = function () {
        var all = patternTimes();
        f.slots.days.forEach(function (d) { d.times.forEach(function (tm) { if (all.indexOf(tm) === -1) all.push(tm); }); });
        return all.sort(function (x, y) { return slotStart(x) - slotStart(y); });
      };
      var grid = function () {
        var rows = rowTimes();
        var head = h('tr', null, h('th', { class: 'tt-corner', scope: 'col' }, 'Time'), f.slots.days.map(function (d, i) {
          var dt = d.date ? new Date(d.date + 'T12:00:00') : null;
          var name = String(d.label || '').trim();
          return h('th', { scope: 'col' }, h('button', { type: 'button', class: 'tt-day' + (d._open ? ' on' : '') + (needsWork(d) ? ' bad' : ''), name: 'day-head-' + i, 'aria-pressed': d._open ? 'true' : 'false', title: name || 'This day has no name yet', onclick: function () { select(d._open ? null : d); paintDays(); } },
            dt ? [h('span', { class: 'dow' }, dt.toLocaleDateString('en-GB', { weekday: 'short' })), h('span', { class: 'dom' }, dt.getDate() + ' ' + dt.toLocaleDateString('en-GB', { month: 'short' }))]
              : [h('span', { class: 'dow' }, 'No date'), h('span', { class: 'dom' }, name || 'Name it')]));
        }));
        var body = rows.map(function (tm, k) {
          var allOn = f.slots.days.every(function (d) { return d.times.indexOf(tm) !== -1; });
          return h('tr', null,
            h('th', { scope: 'row' }, h('button', { type: 'button', class: 'tt-time', name: 'row-' + k, title: allOn ? 'Switch this time off on every day' : 'Switch this time on for every day', onclick: function () {
              f.slots.days.forEach(function (d) {
                var at = d.times.indexOf(tm);
                if (allOn && at !== -1) d.times.splice(at, 1);
                if (!allOn && at === -1) { d.times.push(tm); d.times.sort(function (x, y) { return slotStart(x) - slotStart(y); }); }
              });
              paintDays();
            } }, tm)),
            f.slots.days.map(function (d, i) {
              var at = d.times.indexOf(tm), on = at !== -1, booked = bookedIn(d, tm);
              var what = tm + ', ' + (d.label || 'day ' + (i + 1)) + (booked ? ', ' + booked + ' booked' : '');
              return h('td', null, h('button', { type: 'button', class: 'tt-cell' + (on ? ' on' : '') + (booked ? ' booked' : ''), name: 'cell-' + i + '-' + k, 'aria-pressed': on ? 'true' : 'false', 'aria-label': what, title: what, onclick: function () {
                if (on) d.times.splice(at, 1);
                else { d.times.push(tm); d.times.sort(function (x, y) { return slotStart(x) - slotStart(y); }); }
                paintDays();
              } }, booked ? String(booked) : ''));
            }));
        });
        return h('div', { class: 'tt-grid-wrap' }, h('table', { class: 'tt-grid' }, h('thead', null, head), h('tbody', null, body)));
      };
      var paintDays = function () {
        ui.clear(daysBox);
        if (!f.slots.days.length) {
          daysBox.appendChild(h('div', { class: 'empty' }, 'No days yet. Add a range of days, or one day at a time. Each new day gets the session hours above.'));
        } else {
          if (!f.slots.days.some(function (d) { return d._open; })) select(f.slots.days.filter(needsWork)[0] || null);
          var orphans = 0;
          f.slots.days.forEach(function (d) { rowTimes().forEach(function (tm) { if (d.times.indexOf(tm) === -1) orphans += bookedIn(d, tm); }); });
          daysBox.appendChild(grid());
          daysBox.appendChild(h('p', { class: 'help tt-legend' },
            h('span', { class: 'tt-key on' }), 'open ', h('span', { class: 'tt-key' }), 'off ', h('span', { class: 'tt-key on booked' }, '2'), 'teams booked. ',
            'Click a slot to switch it. Click a time to switch it on every day. Click a day to rename it, move it or remove it.'));
          if (orphans) daysBox.appendChild(h('p', { class: 'error', role: 'alert' }, orphans + ' booking' + (orphans === 1 ? ' is' : 's are') + ' on a slot that is switched off. ' + (orphans === 1 ? 'That team keeps its' : 'Those teams keep their') + ' booking, but the slot no longer shows as valid.'));
          f.slots.days.forEach(function (d, i) { if (d._open) daysBox.appendChild(dayCard(d, i)); });
        }
        paintRange();
        paintApply();
      };
      var dayCard = function (d, i) {
        var count = d.times.length + ' slot' + (d.times.length === 1 ? '' : 's');
        var name = String(d.label || '').trim();
        var row = h('div', { class: 'day-row' },
          h('div', { class: 'day-sum' }, name ? h('strong', null, name) : h('span', { class: 'error' }, 'Pick a date or type a name.'),
            d.times.length ? h('span', { class: 'muted-note' }, count) : h('span', { class: 'error' }, 'No slots. Switch one on in the grid, add a time or reset it.')),
          needsWork(d) ? null : h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'close-day-' + i, onclick: function () { select(null); paintDays(); } }, 'Done'),
          h('button', { type: 'button', class: 'btn btn-quiet sm danger', name: 'remove-day-' + i, onclick: function () { f.slots.days.splice(i, 1); paintDays(); } }, icon('trash', 16), 'Remove day'));

        var label = A.text(d.label, function (v) { d.label = v; d._auto = false; }, { name: 'dayLabel-' + i, placeholder: 'Week 11 - Sunday', 'aria-label': 'Day name' });
        var chips = h('ul', { class: 'time-chips', 'aria-label': 'Time slots for ' + (d.label || 'this day') },
          d.times.map(function (tm, k) {
            return h('li', { class: 'time-chip' }, tm, h('button', { type: 'button', name: 'drop-' + i + '-' + k, 'aria-label': 'Remove ' + tm, onclick: function () { d.times.splice(k, 1); paintDays(); } }, icon('x', 14)));
          }));
        var from = h('input', { class: 'input', type: 'time', name: 'add-from-' + i, 'aria-label': 'Starts' });
        var to = h('input', { class: 'input', type: 'time', name: 'add-to-' + i, 'aria-label': 'Ends' });
        var adder = h('div', { class: 'time-add', hidden: true }, from, h('span', null, 'to'), to,
          h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'add-time-' + i, onclick: function () {
            var mins = function (v) { var m = String(v).match(/^(\d{1,2}):(\d{2})/); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN; };
            var a = mins(from.value), b = mins(to.value);
            if (isNaN(a) || isNaN(b) || b <= a) return toast('Pick a start and a later end time.', 'err');
            var tm = Rules.generateSlots({ start: from.value, end: to.value, length: b - a, gap: 0 })[0];
            if (d.times.indexOf(tm) !== -1) return toast('That time is already there.', 'err');
            d.times.push(tm);
            d.times.sort(function (x, y) { return slotStart(x) - slotStart(y); });
            paintDays();
          } }, 'Add'));
        return h('article', { class: 'day-card open', dataset: { day: String(i) } },
          row,
          h('div', { class: 'day-body' },
            h('div', { class: 'day-fields' },
              A.field('Date', h('input', { class: 'input', type: 'date', name: 'dayDate-' + i, value: d.date || '', onchange: function (e) {
                d.date = e.target.value;
                if (d._auto) d.label = autoLabel(d.date);
                paintDays();
              } }), 'Lets instructors open "today".'),
              A.field('Name students see', label)),
            h('div', { class: 'day-slots-head' }, h('span', { class: 'label' }, count),
              h('button', { type: 'button', class: 'link-btn', name: 'show-add-' + i, onclick: function (e) { adder.hidden = false; e.currentTarget.hidden = true; from.focus(); } }, '+ Add a time'),
              h('button', { type: 'button', class: 'link-btn', name: 'reset-' + i, onclick: function () { var t = patternTimes(); if (!t.length) return toast('Fix the session hours first.', 'err'); d.times = t; paintDays(); } }, 'Reset to session hours')),
            d.times.length ? chips : null,
            adder,
            h('div', { class: 'actions day-actions' },
              h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'next-week-' + i, onclick: function () {
                var copy = newDay(d.date ? addDays(d.date, 7) : '', d.times.slice());
                if (!d.date) copy.label = d.label ? d.label + ' (copy)' : '';
                f.slots.days.splice(i + 1, 0, copy); select(copy); paintDays();
              } }, icon('copy', 16), d.date ? 'Copy to next week' : 'Duplicate'))));
      };

      /* Range: first date, last date and weekdays make all the days in one step. */
      var WEEK = [[6, 'Sat'], [0, 'Sun'], [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri']];
      var MAX_RANGE = 62;
      var range = { from: '', to: '', dow: {} };
      var rangeDates = function () {
        var a = new Date(range.from + 'T12:00:00'), b = new Date(range.to + 'T12:00:00'), out = [];
        if (!range.from || !range.to || isNaN(a) || isNaN(b) || b < a) return out;
        var have = {};
        f.slots.days.forEach(function (d) { if (d.date) have[d.date] = true; });
        for (var d = a, n = 0; d <= b && n < 366; d.setDate(d.getDate() + 1), n++) {
          if (range.dow[d.getDay()] && !have[iso(d)]) out.push(iso(d));
        }
        return out;
      };
      var rangeResult = h('div', { class: 'tt-range-result', 'aria-live': 'polite' });
      var paintRange = function () {
        ui.clear(rangeResult);
        var picked = WEEK.some(function (w) { return range.dow[w[0]]; });
        var note = function (text, cls) { rangeResult.appendChild(h('p', { class: cls || 'muted-note' }, text)); };
        if (!range.from || !range.to) return note('Pick the first date and the last date.');
        if (range.to < range.from) return note('The last date is before the first date.', 'error');
        if (!picked) return note('Pick the weekdays that have sessions.');
        var dates = rangeDates();
        if (!dates.length) return note('Every matching day is already in the timetable.');
        if (dates.length > MAX_RANGE) return note('That is ' + dates.length + ' days. Add at most ' + MAX_RANGE + ' at a time.', 'error');
        // The button exists only while it can add something.
        rangeResult.appendChild(h('button', { type: 'button', class: 'btn btn-primary sm', name: 'range-add', onclick: function () {
          var times = patternTimes();
          if (!times.length) return toast('Fix the session hours first.', 'err');
          dates.forEach(function (date) { f.slots.days.push(newDay(date, times.slice())); });
          // Dated days in calendar order; days without a date keep their place at the end.
          var dated = f.slots.days.filter(function (d) { return d.date; }).sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : 0; });
          f.slots.days = dated.concat(f.slots.days.filter(function (d) { return !d.date; }));
          paintDays();
          toast(dates.length + ' day' + (dates.length === 1 ? '' : 's') + ' added. Save to keep ' + (dates.length === 1 ? 'it' : 'them') + '.', 'ok');
        } }, icon('plus', 18), 'Add ' + dates.length + ' day' + (dates.length === 1 ? '' : 's')));
      };
      var dowBox = h('div', { class: 'toggle-chips', role: 'group', 'aria-label': 'Weekdays' });
      var paintDow = function () {
        ui.clear(dowBox);
        WEEK.forEach(function (w) {
          var on = !!range.dow[w[0]];
          dowBox.appendChild(h('button', { type: 'button', class: 'toggle-chip sm', name: 'range-dow-' + w[0], 'aria-pressed': on ? 'true' : 'false', onclick: function () { range.dow[w[0]] = !on; paintDow(); paintRange(); } }, w[1]));
        });
      };
      paintDow();
      var rangeCard = h('div', { class: 'tt-range' },
        h('h4', null, 'Add several days'),
        h('div', { class: 'tt-range-fields' },
          A.field('First date', h('input', { class: 'input', type: 'date', name: 'range-from', onchange: function (e) { range.from = e.target.value; paintRange(); } })),
          A.field('Last date', h('input', { class: 'input', type: 'date', name: 'range-to', onchange: function (e) { range.to = e.target.value; paintRange(); } })),
          h('div', { class: 'field-row' }, h('span', { class: 'label' }, 'On these weekdays'), dowBox)),
        rangeResult);

      paintDays();
      paintPattern();
      var daysCard = h('div', { class: 'tt-step' },
        h('div', { class: 'tt-step-head' }, h('span', { class: 'tt-num' }, '2'), h('div', null, h('h3', null, 'Days'), h('p', { class: 'help' }, 'Days run across, times run down. Every slot is one square.'))),
        rangeCard,
        daysBox,
        h('button', { type: 'button', class: 'btn btn-quiet', name: 'addDay', onclick: function () {
          var times = patternTimes();
          if (!times.length) return toast('Fix the session hours first.', 'err');
          var last = f.slots.days[f.slots.days.length - 1];
          var day = newDay(last && last.date ? addDays(last.date, 1) : '', times);
          f.slots.days.push(day);
          select(day);
          paintDays();
          var cards = daysBox.querySelectorAll('.day-card');
          var input = cards.length && cards[cards.length - 1].querySelector('input[type="date"]');
          if (input && input.focus) input.focus();
        } }, icon('plus', 20), 'Add one day'));
      slotsPanel = panel('Timetable', 'The days and times that students can book. Students see taken slots crossed out.', capCard, hoursCard, daysCard);
      slotsPanel.summary = function () {
        var n = f.slots.days.reduce(function (sum, d) { return sum + d.times.length; }, 0);
        if (!f.slots.days.length) return 'No days yet';
        return plural(f.slots.days.length, 'day', 'days') + ' · ' + plural(n, 'slot', 'slots') + ' · ' + plural(f.slots.capacity || 1, 'booking', 'bookings') + ' per slot';
      };
    }

    /* Review ----------------------------------------------------- */
    var reviewPanel = null;
    var stepsBox = h('div');
    var paintSteps = function () {
      ui.clear(stepsBox);
      f.review.steps.forEach(function (s, i) {
        stepsBox.appendChild(h('div', { class: 'row', dataset: { step: s.id } },
          A.field('Step ' + (i + 1) + ' name (English)', A.text(s.label.en, function (v) { s.label.en = v; })),
          A.field('Name (Arabic)', A.text(s.label.ar, function (v) { s.label.ar = v; }, { dir: 'rtl', lang: 'ar' })),
          h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: function () { f.review.steps.splice(i, 1); paintSteps(); } }, icon('trash', 18), 'Remove')));
      });
    };
    paintSteps();
    reviewPanel = panel('Review steps', 'Reviewers (you or an instructor link that can review) mark each step as pending, approved, or rejected.',
      stepsBox,
      h('button', { type: 'button', class: 'btn btn-quiet', name: 'addStep', onclick: function () {
        var n = f.review.steps.length + 1;
        var id = 'step' + n;
        while (f.review.steps.some(function (s) { return s.id === id; })) id = 'step' + (++n);
        var count = f.review.steps.length + 1;
        f.review.steps.push({ id: id, label: { en: 'Review step ' + count, ar: 'خطوة مراجعة ' + count } });
        paintSteps();
      } }, icon('plus', 20), 'Add a review step'),
      f.type === 'whatsapp_registration' ? A.check('Match registrations to pasted WhatsApp requests', f.matching && f.matching.enabled, function (v) { f.matching = Object.assign({ field: 'phone' }, f.matching || {}, { enabled: v }); }) : null);

    /* Summaries --------------------------------------------------- */
    if (teammatePanel) teammatePanel.summary = function () { return reservationMembers.enabled !== false ? 'Asked' : 'Not asked'; };
    if (sizePanel) sizePanel.summary = function () {
      var min = f.rules.teamSize.min, max = f.rules.teamSize.max;
      return String(min) === String(max) ? plural(parseInt(min, 10) || 0, 'person', 'people') : min + ' to ' + max + ' people';
    };
    keyPanel.summary = function () {
      if (!f.editKey.enabled) return 'Off';
      var may = [f.editKey.allowEdit ? 'edit' : '', f.editKey.allowDelete ? 'cancel' : ''].filter(Boolean).join(' and ');
      return 'On, ' + plural(f.editKey.days, 'day', 'days') + (may ? ', students can ' + may : ', students cannot change anything');
    };
    emailPanel.summary = function () {
      return (f.notifications.confirmEmail !== false ? 'Confirmation to students' : 'No confirmation') + (f.notifications.alertEmail ? ' · note to ' + f.notifications.alertEmail : '');
    };
    rulesPanel.summary = function () {
      return [f.rules.maxSubmissions ? 'At most ' + f.rules.maxSubmissions : 'No limit', isTeam && f.rules.uniqueAcrossForm ? 'one team per student' : ''].filter(Boolean).join(' · ');
    };
    reviewPanel.summary = function () { return f.review.steps.length ? f.review.steps.map(function (x) { return x.label.en; }).join(', ') : 'None'; };

    /* Save ------------------------------------------------------- */
    /** Everything the page can change, as the server expects it. Also compared with the saved copy to know if there is something to save. */
    var buildPatch = function () {
      var patch = {
        title: f.title, slug: f.slug, status: f.status, opensAt: f.opensAt || '', closesAt: f.closesAt || '',
        lang: f.lang, icon: f.icon, editKey: f.editKey, rules: f.rules, notifications: f.notifications,
        fields: f.fields, review: f.review
      };
      if (f.steps) patch.steps = f.steps;
      if (isReservation && reservationMembers) {
        reservationMembers.enabled = !!reservationMembers.enabled;
        reservationMembers.required = reservationMembers.enabled;
      }
      Object.assign(patch, metadata);
      if (isReservation) patch.keyBooking = { enabled: !!f.keyBooking.enabled, source: f.keyBooking.source || '' };
      if (f.matching) patch.matching = f.matching;
      if (hasSize) {
        var nt = f.rules.teamSize.notice;
        patch.rules = Object.assign({}, f.rules, { teamSize: { min: parseInt(f.rules.teamSize.min, 10), max: parseInt(f.rules.teamSize.max, 10), notice: nt && nt.sizes.length ? nt : null } });
      }
      if (f.slots) {
        patch.slots = {
          capacity: f.slots.capacity || 1,
          pattern: f.slots.pattern,
          days: f.slots.days.map(function (d) { return { id: d.id, label: d.label, date: d.date, times: d.times.slice() }; })
        };
      }
      return patch;
    };
    /** The first thing that stops a save, with the section it is in; null when the page can be saved. */
    var problem = function () {
      if ((f.steps || []).some(function (st) { return !(st.title.en || '').trim() && !(st.title.ar || '').trim(); })) return { panel: fieldsPanel, text: 'Give every page a title, or remove the page.' };
      var added = (f.fields || []).filter(function (fd) { return fd.custom; });
      if (added.some(function (fd) { return !(fd.label.en || '').trim() && !(fd.label.ar || '').trim(); })) return { panel: fieldsPanel, text: 'Write the question for every question you added, or remove it.' };
      var few = added.filter(function (fd) { return fd.type === 'select' && (fd.options || []).length < 2; })[0];
      if (few) return { panel: fieldsPanel, text: '"' + (few.label.en || few.label.ar) + '" needs at least two choices.' };
      if (hasSize) {
        var min = parseInt(f.rules.teamSize.min, 10), max = parseInt(f.rules.teamSize.max, 10);
        if (!(min >= 1) || !(max >= min) || max > 20) return { panel: sizePanel, text: 'Team size needs a minimum of at least 1 and a maximum that is not lower, up to 20.' };
        var nt = f.rules.teamSize.notice;
        if (nt && nt.sizes.length && !(nt.text.en || '').trim() && !(nt.text.ar || '').trim()) return { panel: sizePanel, text: 'Write the team size note, or switch off its sizes.' };
      }
      if (f.slots) {
        if (f.slots.days.some(function (d) { return !String(d.label || '').trim(); })) return { panel: slotsPanel, text: 'Give every day a date or a name.' };
        var empty = f.slots.days.filter(function (d) { return !d.times.length; })[0];
        if (empty) return { panel: slotsPanel, text: '"' + empty.label + '" has no time slots.' };
      }
      return null;
    };
    var saveBtn = h('button', { type: 'button', class: 'btn btn-primary', name: 'save' }, 'Save settings');
    saveBtn.addEventListener('click', function () {
      A.busy(saveBtn, async function () {
        var stop = problem();
        if (stop) { show(stop.panel.tab); stop.panel.setOpen(true); return toast(stop.text, 'err'); }
        var out = await A.call('admin.forms.update', { id: f.id, patch: buildPatch() });
        A.unsaved = false;
        toast('Settings saved', 'ok');
        if (out.teamSizeConflicts) toast(out.teamSizeConflicts + ' saved team(s) now fall outside this team size range.', 'err');
        if (out.orphanedBookings) toast(out.orphanedBookings + ' booking(s) are on slots that no longer exist.', 'err');
        if (out.form.slug !== slug) window.location.hash = '#/f/' + encodeURIComponent(out.form.slug) + '/settings';
        else A.render();
      });
    });

    var dangerPanel = panel('Delete this form', 'The link stops working and the form leaves the dashboard. Its Google Sheet moves to the Drive trash for 30 days. To stop new registrations but keep everything, set the status to Closed or Archived instead.',
      h('button', { type: 'button', class: 'btn btn-danger', name: 'delete-form', onclick: function () { A.deleteForm(f, function () { window.location.hash = '#/'; }); } }, icon('trash', 18), 'Delete form'));
    dangerPanel.classList.add('danger-zone');
    /* Tabs: the two work areas (questions, timetable) and the settings proper. */
    var tabs = [
      { id: 'questions', label: 'Questions', panels: [fieldsPanel, sizePanel, teammatePanel] },
      slotsPanel ? { id: 'timetable', label: 'Timetable', panels: [slotsPanel, keyBookPanel], alert: function () { return !f.slots.days.length; } } : null,
      { id: 'settings', label: 'Setup', panels: [general, majorsPanel, keyPanel, emailPanel, rulesPanel, reviewPanel, dangerPanel] }
    ].filter(Boolean);
    tabs.forEach(function (tab) { tab.panels = tab.panels.filter(Boolean); tab.panels.forEach(function (n) { n.tab = tab; }); });
    fieldsPanel.pin();
    if (slotsPanel) slotsPanel.pin();
    var sections = [];
    tabs.forEach(function (tab) { sections = sections.concat(tab.panels); });
    var open = opened[f.id] = opened[f.id] || {};
    sections.forEach(function (n) {
      if (n.pinned) return;
      n.setOpen(!!open[n.panelTitle]);
      n.onToggle = function (isOpen) { open[n.panelTitle] = isOpen; };
    });

    var tabBar = h('div');
    var current = tabs.filter(function (tab) { return tab.id === startTab; })[0] || tabs[tabs.length - 1];
    var show = function (tab) {
      current = tab;
      sections.forEach(function (n) { n.hidden = n.tab !== tab; });
      ui.clear(tabBar);
      tabBar.appendChild(A.formTabs(f, tab.id, function (id) {
        var next = tabs.filter(function (x) { return x.id === id; })[0];
        if (!next) return false;
        // The address follows the tab without loading the page again, so changes in other tabs stay.
        A.setHash('#/f/' + encodeURIComponent(slug) + '/' + id);
        show(next);
        return true;
      }, tabs.filter(function (x) { return x.alert && x.alert(); }).map(function (x) { return x.id; })));
    };

    /* Unsaved changes: the bar exists only while there is something to save. */
    var saved = JSON.stringify(buildPatch());
    var bar = h('div', { class: 'savebar', hidden: true }, h('span', { class: 'savebar-note', role: 'status' }, 'You have changes that are not saved.'),
      h('button', { type: 'button', class: 'btn btn-quiet', name: 'discard', onclick: function () { A.unsaved = false; A.render(); } }, 'Discard'), saveBtn);
    var refresh = function () {
      sections.forEach(function (n) { n.paintSummary(); });
      A.unsaved = JSON.stringify(buildPatch()) !== saved;
      bar.hidden = !A.unsaved;
    };
    // Controls change the form object in their own handlers; these run after them, as the event reaches the page.
    ['input', 'change', 'click'].forEach(function (type) { mount.addEventListener(type, refresh); });

    mount.appendChild(tabBar);
    sections.forEach(function (n) { mount.appendChild(n); });
    mount.appendChild(bar);
    show(current);
    refresh();
  };
})(window.App = window.App || {});
