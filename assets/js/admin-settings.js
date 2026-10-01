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

  function panel(title, help) {
    var body = Array.prototype.slice.call(arguments, 2);
    return h('section', { class: 'panel' }, h('h2', null, title), help ? h('p', { class: 'help' }, help) : null, body);
  }

  A.views.settings = async function (mount, slug) {
    var res = await A.call('admin.forms.get', { id: slug });
    var f = res.form;
    f.lang = f.lang || { default: 'en', allowSwitch: true };
    f.editKey = f.editKey || { enabled: true, days: 7, allowEdit: true, allowDelete: true };
    f.rules = f.rules || {};
    f.notifications = f.notifications || {};
    f.review = f.review || { steps: [] };
    if (f.slots) f.slots.days.forEach(function (d) { d._timesText = d.times.join('\n'); d._gen = { start: '12:30', end: '15:30', length: '20', gap: '5' }; });

    var t = A.TYPES[f.type] || { label: f.type };
    var link = A.formLink(f.slug);
    var hasSize = !!Rules.fieldByRole(f, 'team_size');
    var hasDrive = (f.fields || []).some(function (x) { return x.type === 'drive_link'; });
    var isTeam = f.type === 'team_registration' || f.type === 'task_submission';

    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' },
      h('h2', null, f.title), A.termTags(f), A.badge(A.STATUS_LABEL[f.status] || f.status, f.status), h('span', { class: 'muted-note' }, t.label),
      h('a', { class: 'btn btn-quiet sm', href: '#/f/' + encodeURIComponent(f.slug) }, 'Responses'),
      h('a', { class: 'btn btn-quiet sm', href: link, target: '_blank', rel: 'noopener' }, 'Open form'),
      h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: async function () { toast((await ui.copyText(link)) ? 'Form link copied' : 'Could not copy', 'ok'); } }, icon('link', 18), 'Copy link')));

    /* General ---------------------------------------------------- */
    var general = panel('General', 'Students can only submit while the status is Open and the current time is inside the dates below.',
      A.field('Title', A.text(f.title, function (v) { f.title = v; }, { name: 'title' }), 'The heading students see.'),
      A.termPicker({ term: f.term, subject: f.subject }, function (v) { f.term = v.term; f.subject = v.subject; }),
      h('div', { class: 'row' },
        A.field('Link name', A.text(f.slug, function (v) { f.slug = v; }, { name: 'slug', dir: 'ltr' }), 'The form address ends with ?f= and this name. Changing it breaks links already shared.'),
        A.field('Status', A.select(f.status, [['draft', 'Draft (hidden)'], ['open', 'Open'], ['closed', 'Closed'], ['archived', 'Archived']], function (v) { f.status = v; }))),
      h('div', { class: 'row' },
        A.field('Opens at', h('input', { class: 'input', type: 'datetime-local', name: 'opensAt', value: toLocal(f.opensAt), onchange: function (e) { f.opensAt = fromLocal(e.target.value); } }), 'Leave empty to open as soon as the status is Open.'),
        A.field('Closes at', h('input', { class: 'input', type: 'datetime-local', name: 'closesAt', value: toLocal(f.closesAt), onchange: function (e) { f.closesAt = fromLocal(e.target.value); } }), 'Leave empty to stay open until you close it.')),
      h('div', { class: 'row' },
        A.field('Form language', A.select(f.lang.default, [['en', 'English'], ['ar', 'Arabic']], function (v) { f.lang.default = v; })),
        A.field('Header icon', A.select(f.icon || 'none', [['team', 'Team'], ['calendar', 'Calendar'], ['task', 'Task'], ['chat', 'Chat'], ['none', 'None']], function (v) { f.icon = v; })),
        h('div', { class: 'field-row' }, A.check('Show the language switch to students', f.lang.allowSwitch !== false, function (v) { f.lang.allowSwitch = v; }))));

    /* Who can register --------------------------------------------- */
    var majorsPanel = null;
    var majorOptions = (res.lists && res.lists.majors) || [];
    var hasMajor = (f.fields || []).some(function (x) { return x.list === 'majors' && x.enabled !== false; });
    if (hasMajor && majorOptions.length) {
      f.rules.majors = Array.isArray(f.rules.majors) ? f.rules.majors.slice() : [];
      var majorChips = h('div', { class: 'toggle-chips', role: 'group', 'aria-label': 'Specializations allowed' });
      var majorNote = h('p', { class: 'muted-note' });
      var paintMajors = function () {
        ui.clear(majorChips);
        var all = !f.rules.majors.length;
        majorChips.appendChild(h('button', { type: 'button', class: 'toggle-chip', name: 'major-all', 'aria-pressed': all ? 'true' : 'false', onclick: function () { f.rules.majors = []; paintMajors(); } }, 'All specializations'));
        majorOptions.forEach(function (o) {
          var on = f.rules.majors.indexOf(String(o.value)) !== -1;
          majorChips.appendChild(h('button', { type: 'button', class: 'toggle-chip', name: 'major-' + o.value, 'aria-pressed': on ? 'true' : 'false', onclick: function () {
            f.rules.majors = on ? f.rules.majors.filter(function (v) { return v !== String(o.value); }) : f.rules.majors.concat([String(o.value)]);
            if (f.rules.majors.length === majorOptions.length) f.rules.majors = [];
            paintMajors();
          } }, (o.label && o.label.en) || o.value, o.label && o.label.ar && o.label.ar !== o.label.en ? h('span', { class: 'chip-sub', lang: 'ar' }, o.label.ar) : null));
        });
        var names = majorOptions.filter(function (o) { return f.rules.majors.indexOf(String(o.value)) !== -1; }).map(function (o) { return (o.label && o.label.en) || o.value; });
        majorNote.textContent = !names.length ? 'Students of every specialization can register.'
          : names.length === 1 ? 'Only ' + names[0] + ' students can register. The Major question is filled in for them and locked.'
          : 'Only ' + names.join(' and ') + ' students can register.';
      };
      paintMajors();
      majorsPanel = panel('Who can register', 'Limit this form to some specializations. The choices come from the Majors list. Students of other specializations cannot submit.', majorChips, majorNote);
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
      h('p', { class: 'help' }, 'When the Drive check is on, the folder name is read and must look like Name_Project_Name_Subject: no spaces, parts joined by underscores, ending with the subject. Students see the rule with an example.'),
      A.check('Folder names must follow Name_Project_Name_Subject', f.rules.folderName.enabled, function (v) { f.rules.folderName.enabled = v; }),
      A.field('Subject at the end of the name', A.text(f.rules.folderName.subject || '', function (v) { f.rules.folderName.subject = v.replace(/\s+/g, ''); }, { name: 'folderSubject', dir: 'ltr', placeholder: f.subject || 'SubjectName' }), 'Leave empty to use the subject code' + (f.subject ? ' (' + f.subject + ')' : '') + '.')) : null;
    var rulesPanel = panel('Limits and checks', null,
      h('div', { class: 'row' },
        A.field('Maximum submissions', A.number(f.rules.maxSubmissions == null ? '' : f.rules.maxSubmissions, function (v) { f.rules.maxSubmissions = v === '' ? null : parseInt(v, 10); }, { name: 'maxSubmissions', min: '1' }), 'Leave empty for no limit.'),
        hasDrive ? A.field('Google Drive links', A.select(f.rules.driveCheck || 'strict', [['strict', 'Must open and be shared with anyone who has the link'], ['off', 'Do not check']], function (v) { f.rules.driveCheck = v; })) : null),
      isTeam ? A.check('A student may appear in only one team of this form', f.rules.uniqueAcrossForm, function (v) { f.rules.uniqueAcrossForm = v; }) : null,
      h('div', { class: 'row' },
        h('div', { class: 'field-row' }, A.check('Email each student a confirmation', f.notifications.confirmEmail !== false, function (v) { f.notifications.confirmEmail = v; })),
        A.field('Email me a note for every new submission', A.text(f.notifications.alertEmail || '', function (v) { f.notifications.alertEmail = v.trim(); }, { name: 'alertEmail', type: 'email', placeholder: 'you@example.com' }), 'Optional.')),
      folderBox);

    /* Fields ----------------------------------------------------- */
    var rows = [];
    function hasHelp(fd) { return !!(fd.help && ((fd.help.en || '').trim() || (fd.help.ar || '').trim())); }
    function fieldRow(fd, sub) {
      var locked = LOCKED_ROLES.indexOf(fd.role) !== -1;
      // The description row stays hidden until it has text or the admin asks for it.
      var descRow = h('tr', { class: 'desc-row' + (sub ? ' sub' : ''), dataset: { desc: fd.id }, hidden: !hasHelp(fd) },
        h('td', null),
        h('td', { colspan: '4' }, h('div', { class: 'desc-edit' },
          h('span', { class: 'label' }, 'Description students see under this question'),
          h('div', { class: 'desc-pair' },
            h('textarea', { class: 'textarea', rows: '2', name: 'help-en-' + fd.id, 'aria-label': 'English description for ' + fd.id, placeholder: 'English, for example: In case of 3 or 4, other students will be added to reach 5', oninput: function (e) { fd.help = Object.assign({}, fd.help, { en: e.target.value }); } }, (fd.help && fd.help.en) || ''),
            h('textarea', { class: 'textarea', rows: '2', name: 'help-ar-' + fd.id, 'aria-label': 'Arabic description for ' + fd.id, dir: 'rtl', lang: 'ar', placeholder: 'بالعربي', oninput: function (e) { fd.help = Object.assign({}, fd.help, { ar: e.target.value }); } }, (fd.help && fd.help.ar) || '')),
          h('button', { type: 'button', class: 'link-btn', onclick: function () { fd.help = { en: '', ar: '' }; descRow.querySelectorAll('textarea').forEach(function (t) { t.value = ''; }); descRow.hidden = true; descBtn.hidden = false; } }, 'Remove description'))));
      var descBtn = h('button', { type: 'button', class: 'link-btn add-desc', name: 'desc-' + fd.id, hidden: hasHelp(fd), onclick: function () {
        descRow.hidden = false; descBtn.hidden = true;
        var first = descRow.querySelector('textarea'); if (first) first.focus();
      } }, '+ Description');
      var tr = h('tr', { class: sub ? 'sub' : null, dataset: { field: fd.id } },
        h('td', null, A.check('', fd.enabled !== false, function (v) { fd.enabled = v; }, locked)),
        h('td', null, A.text(fd.label.en, function (v) { fd.label.en = v; }, { 'aria-label': 'English label for ' + fd.id }), descBtn),
        h('td', null, A.text(fd.label.ar, function (v) { fd.label.ar = v; }, { 'aria-label': 'Arabic label for ' + fd.id, dir: 'rtl', lang: 'ar' })),
        h('td', null, A.check('', fd.required !== false, function (v) { fd.required = v; }, locked)),
        h('td', null, fd.type === 'arabic_name' ? A.number(fd.minParts || 4, function (v) { fd.minParts = parseInt(v, 10) || 4; }, { class: 'input num', min: '2', max: '6', 'aria-label': 'Name parts for ' + fd.id }) : h('span', { class: 'muted-note' }, fd.type.replace('_', ' '))));
      rows.push(tr, descRow);
      if (fd.type === 'members') (fd.fields || []).forEach(function (sf) { fieldRow(sf, true); });
    }
    (f.fields || []).forEach(function (fd) { fieldRow(fd, false); });
    var fieldsPanel = panel('Questions', 'Rename a question, hide the ones you do not need, or make optional ones required. Add a description to explain a question: students see it right under the question. Team size, names, codes, and the booking slot are always required. For names, the number is how many name parts are needed (4 means a four-part name).',
      h('div', { class: 'scroll-x' }, h('table', { class: 'fields-table' },
        h('thead', null, h('tr', null, h('th', null, 'Show'), h('th', null, 'English label'), h('th', null, 'Arabic label'), h('th', null, 'Required'), h('th', null, 'Name parts / type'))),
        h('tbody', null, rows))));

    /* Slots ------------------------------------------------------ */
    var slotsPanel = null;
    if (f.type === 'reservation') {
      f.slots = f.slots || { days: [], capacity: 1 };
      var daysBox = h('div');
      var paintDays = function () {
        ui.clear(daysBox);
        if (!f.slots.days.length) daysBox.appendChild(h('div', { class: 'empty' }, 'No days yet. Add a day, then fill its times.'));
        f.slots.days.forEach(function (d, i) { daysBox.appendChild(dayCard(d, i)); });
      };
      var dayCard = function (d, i) {
        var area = h('textarea', { class: 'textarea', rows: '6', name: 'times-' + i, 'aria-label': 'Times for ' + (d.label || 'day ' + (i + 1)), dir: 'ltr', oninput: function (e) { d._timesText = e.target.value; } });
        area.value = d._timesText || '';
        var gen = function (key, label, type) {
          return A.field(label, h('input', { class: 'input', type: type, value: d._gen[key], oninput: function (e) { d._gen[key] = e.target.value; } }));
        };
        return h('div', { class: 'day-card', dataset: { day: String(i) } },
          h('div', { class: 'row' },
            A.field('Day name', A.text(d.label, function (v) { d.label = v; }, { name: 'dayLabel-' + i, placeholder: 'Week 11 - Sunday' })),
            A.field('Date (optional)', h('input', { class: 'input', type: 'date', name: 'dayDate-' + i, value: d.date || '', onchange: function (e) { d.date = e.target.value; } }), 'Lets instructors see "today".')),
          h('div', { class: 'gen' }, gen('start', 'First slot starts', 'time'), gen('end', 'Last slot ends by', 'time'), gen('length', 'Minutes per slot', 'number'), gen('gap', 'Minutes between', 'number'),
            h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'fill-' + i, onclick: function () {
              var times = Rules.generateSlots({ start: d._gen.start, end: d._gen.end, length: d._gen.length, gap: d._gen.gap });
              if (!times.length) return toast('Those times do not make any slots. Check the start, end, and length.', 'err');
              d._timesText = times.join('\n');
              area.value = d._timesText;
            } }, 'Fill the times')),
          A.field('Time slots (one per line)', area),
          h('div', { class: 'actions' },
            h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: function () { f.slots.days.forEach(function (o) { o._timesText = d._timesText; }); paintDays(); toast('Copied to every day', 'ok'); } }, 'Use these times for every day'),
            h('button', { type: 'button', class: 'btn btn-quiet sm', onclick: function () { f.slots.days.splice(i, 1); paintDays(); } }, icon('trash', 18), 'Remove day')));
      };
      paintDays();
      slotsPanel = panel('Days and time slots', 'Each slot can be booked by one team (or more if you raise the capacity). Students see taken slots crossed out.',
        h('div', { class: 'row' }, A.field('Teams per slot', A.number(f.slots.capacity || 1, function (v) { f.slots.capacity = parseInt(v, 10) || 1; }, { name: 'capacity', min: '1' }))),
        daysBox,
        h('button', { type: 'button', class: 'btn btn-quiet', name: 'addDay', onclick: function () {
          f.slots.days.push({ label: '', date: '', times: [], _timesText: '', _gen: { start: '12:30', end: '15:30', length: '20', gap: '5' } });
          paintDays();
        } }, icon('plus', 20), 'Add a day'));
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

    /* Save ------------------------------------------------------- */
    var saveBtn = h('button', { type: 'button', class: 'btn btn-primary', name: 'save' }, 'Save settings');
    saveBtn.addEventListener('click', function () {
      A.busy(saveBtn, async function () {
        var patch = {
          title: f.title, term: f.term, subject: f.subject || '', slug: f.slug, status: f.status, opensAt: f.opensAt || '', closesAt: f.closesAt || '',
          lang: f.lang, icon: f.icon, editKey: f.editKey, rules: f.rules, notifications: f.notifications,
          fields: f.fields, review: f.review
        };
        if (f.matching) patch.matching = f.matching;
        if (hasSize) {
          var min = parseInt(f.rules.teamSize.min, 10), max = parseInt(f.rules.teamSize.max, 10);
          if (!(min >= 1) || !(max >= min) || max > 20) return toast('Team size needs a minimum of at least 1 and a maximum that is not lower, up to 20.', 'err');
          var nt = f.rules.teamSize.notice;
          if (nt && nt.sizes.length && !(nt.text.en || '').trim() && !(nt.text.ar || '').trim()) return toast('Write the team size note, or switch off its sizes.', 'err');
          patch.rules = Object.assign({}, f.rules, { teamSize: { min: min, max: max, notice: nt && nt.sizes.length ? nt : null } });
        }
        if (f.slots) {
          patch.slots = {
            capacity: f.slots.capacity || 1,
            days: f.slots.days.map(function (d) { return { id: d.id, label: d.label, date: d.date, times: String(d._timesText || '').split(/\r?\n/) }; })
          };
        }
        var out = await A.call('admin.forms.update', { id: f.id, patch: patch });
        toast('Settings saved', 'ok');
        if (out.teamSizeConflicts) toast(out.teamSizeConflicts + ' saved team(s) now fall outside this team size range.', 'err');
        if (out.orphanedBookings) toast(out.orphanedBookings + ' booking(s) are on slots that no longer exist.', 'err');
        if (out.form.slug !== slug) window.location.hash = '#/f/' + encodeURIComponent(out.form.slug) + '/settings';
        else A.render();
      });
    });

    [general, majorsPanel, sizePanel, fieldsPanel, slotsPanel, keyPanel, rulesPanel, reviewPanel].forEach(function (n) { if (n) mount.appendChild(n); });
    mount.appendChild(h('div', { class: 'savebar' }, h('span', { class: 'muted-note' }, 'Changes apply to students as soon as you save.'), saveBtn));
  };
})(window.App = window.App || {});
