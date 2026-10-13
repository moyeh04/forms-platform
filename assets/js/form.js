/**
 * The public form. Renders any form definition from the backend:
 * steps with a route trail, live Arabic-only names, repeating team members,
 * slot picking, a review step, the success ticket, and edit-by-key.
 * A reservation booked with a registration key asks for the key and the slot only.
 */
(function (App) {
  'use strict';

  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = function (k, p) { return App.i18n.t(k, p); };
  var L = function (o) { return App.i18n.L(o); };
  var root = document.getElementById('app');

  var S = {
    slug: '', form: null, state: '', taken: {}, view: 'loading', loadError: '',
    steps: [], stepIndex: 0, data: {}, errors: {}, banner: null, busy: false,
    mode: 'new', key: '', keyInfo: null, ownSlot: '', result: null, keyError: '',
    team: null, teamBooked: false, sourceKey: '', teamKey: '', teamError: ''
  };

  /* ── Data helpers ───────────────────────────────────────────── */

  function getVal(path) {
    var cur = S.data;
    var parts = path.split('.');
    for (var i = 0; i < parts.length && cur != null; i++) cur = cur[parts[i]];
    return cur;
  }

  function setVal(path, v) {
    var parts = path.split('.');
    var cur = S.data;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null) cur[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }

  function activeFields() { return (S.form.fields || []).filter(function (f) { return f.enabled !== false; }); }

  function fieldById(id) { return activeFields().filter(function (f) { return f.id === id; })[0]; }

  function slotField() { return Rules.fieldByRole(S.form, 'slot'); }

  /** True while a new booking is made with a registration key instead of typed answers. */
  function keyMode() { return !!(S.form && S.form.keyBooking) && S.mode === 'new'; }

  /* ── Steps ──────────────────────────────────────────────────── */

  function buildSteps() {
    if (keyMode()) {
      var sf = slotField();
      var def = (S.form.steps || []).filter(function (s) { return s.fields.indexOf(sf.id) !== -1; })[0];
      S.steps = [{ id: '_team', team: true, fields: [] }, { id: 'slot', title: def ? def.title : sf.label, fields: [sf] }, { id: '_review', review: true, fields: [] }];
      return;
    }
    var fields = activeFields();
    var byId = {};
    fields.forEach(function (f) { byId[f.id] = f; });
    var defs = S.form.steps && S.form.steps.length ? S.form.steps : [{ id: 'all', title: { en: 'Details', ar: 'البيانات' }, fields: fields.map(function (f) { return f.id; }) }];
    var used = {};
    var steps = defs.map(function (s) {
      return { id: s.id, title: s.title, fields: s.fields.filter(function (id) { return byId[id]; }).map(function (id) { used[id] = true; return byId[id]; }) };
    }).filter(function (s) { return s.fields.length; });
    var left = fields.filter(function (f) { return !used[f.id]; });
    if (left.length) {
      if (!steps.length) steps.push({ id: 'more', title: { en: 'Details', ar: 'البيانات' }, fields: [] });
      steps[steps.length - 1].fields = steps[steps.length - 1].fields.concat(left);
    }
    steps.push({ id: '_review', review: true, fields: [] });
    S.steps = steps;
  }

  function stepTitle(s) { return s.review ? t('reviewStep') : s.team ? t('teamStep') : L(s.title); }

  function stepOfPath(path) {
    var id = path.split('.')[0];
    for (var i = 0; i < S.steps.length; i++) {
      for (var j = 0; j < S.steps[i].fields.length; j++) if (S.steps[i].fields[j].id === id) return i;
    }
    return 0;
  }

  /* ── Drafts: a reload should not wipe a half-filled form ───── */

  function draftKey() { return 'fp_draft_' + S.slug; }
  function sess() { try { return window.sessionStorage; } catch (e) { return null; } }
  function saveDraft() {
    var s = sess();
    if (s && S.mode === 'new') s.setItem(draftKey(), JSON.stringify({ data: S.data, step: S.stepIndex }));
  }
  function restoreDraft() {
    var s = sess();
    var raw = s && s.getItem(draftKey());
    if (!raw) return;
    try {
      var d = JSON.parse(raw);
      S.data = d.data || {};
      // The team is asked for again after a reload: the key is never kept in the browser.
      S.stepIndex = keyMode() ? 0 : Math.min(d.step || 0, S.steps.length - 1);
    } catch (e) { /* ignore a broken draft */ }
  }
  function clearDraft() { var s = sess(); if (s) s.removeItem(draftKey()); }

  /* ── Loading ────────────────────────────────────────────────── */

  async function load() {
    S.view = 'loading';
    render();
    try {
      var res = await App.api.call({ action: 'getForm', slug: S.slug });
      S.form = res.form;
      S.state = res.state;
      S.taken = res.taken || {};
      var metadata = FormMetadata.display(S.form);
      document.title = S.form.title + metadata.map(function (item) { return item.variant === 'subject' ? ' (' + item.value + ')' : ' - ' + item.value; }).join('');
      var cfg = S.form.lang || {};
      var lang = cfg.allowSwitch === false ? cfg.default || 'en' : App.i18n.saved() || cfg.default || 'en';
      App.i18n.set(lang);
      if (S.state === 'open' || S.state === 'closed') buildSteps();
      if (S.state === 'open') { restoreDraft(); S.view = 'form'; } else S.view = 'closed';
    } catch (e) {
      S.loadError = e.code === 'form_not_found' ? t('notFound') : App.i18n.err({ error: e.code }) || e.message;
      S.view = 'error';
    }
    render();
  }

  async function refreshAvailability() {
    try {
      var res = await App.api.call({ action: 'getForm', slug: S.slug });
      S.taken = res.taken || {};
    } catch (e) { /* keep what we have */ }
  }

  /* ── Page chrome ────────────────────────────────────────────── */

  function topbar() {
    var bar = h('div', { class: 'topbar' });
    var allow = !S.form || !S.form.lang || S.form.lang.allowSwitch !== false;
    if (allow) {
      bar.appendChild(h('button', { type: 'button', class: 'icon-btn', lang: App.i18n.lang === 'ar' ? 'en' : 'ar', onclick: function () {
        App.i18n.set(App.i18n.lang === 'ar' ? 'en' : 'ar', true);
        render();
      } }, t('langToggle')));
    }
    bar.appendChild(App.ui.themeButton(t('themeToggle')));
    return bar;
  }

  /** "Computers students only", from the form's allowed specializations. */
  function audience() {
    var allowed = S.form && S.form.rules && S.form.rules.majors;
    if (!allowed || !allowed.length) return null;
    var mf = (S.form.fields || []).filter(function (f) { return f.list === 'majors'; })[0];
    var names = allowed.map(function (v) {
      var o = mf && (mf.options || []).filter(function (x) { return String(x.value) === String(v); })[0];
      return o ? L(o.label) : v;
    });
    return h('p', { class: 'audience' }, icon('team', 18), h('span', null, t('onlyFor', { names: names.join(t('and')) })));
  }

  function head() {
    var ic = S.form && S.form.icon !== 'none' ? App.ui.formIcon(S.form.icon) : null;
    return h('header', { class: 'form-head' },
      ic ? h('span', { class: 'form-icon' }, icon(ic, 30)) : null,
      h('h1', { class: 'form-title' }, S.form ? S.form.title : ''),
      S.form && FormMetadata.display(S.form).length ? h('div', { class: 'tags' },
        FormMetadata.display(S.form).map(function (item) {
          return h('span', { class: 'tag' + (item.variant === 'subject' ? ' tag-subject' : ''), lang: item.variant === 'subject' ? 'en' : null, dir: item.variant === 'subject' ? 'ltr' : null }, item.value);
        })) : null,
      audience()
    );
  }

  function trail() {
    var items = S.steps.map(function (s, i) {
      return h('li', { class: i < S.stepIndex ? 'is-done' : i === S.stepIndex ? 'is-current' : '', 'aria-current': i === S.stepIndex ? 'step' : null },
        // The ship is over the step the student is on, and moves with it toward the X.
        i === S.stepIndex ? h('span', { class: 'trail-ship' }, icon('ship', 40)) : null,
        h('span', { class: 'dot' }), h('span', { class: 'trail-label' }, stepTitle(s)));
    });
    items.push(h('li', { class: 'trail-x', 'aria-hidden': 'true' }, icon('x', 22)));
    return [
      h('ol', { class: 'trail' }, items),
      h('p', { class: 'step-count' }, t('stepOf', { n: S.stepIndex + 1, total: S.steps.length }) + ' - ' + stepTitle(S.steps[S.stepIndex]))
    ];
  }

  function sheet() {
    return h('section', { class: 'sheet' }, h('div', { class: 'wrap' }, Array.prototype.slice.call(arguments)));
  }

  function bannerEl() {
    if (!S.banner) return null;
    return h('div', { class: 'banner' + (S.banner.kind === 'info' ? ' info' : ''), role: S.banner.kind === 'info' ? 'status' : 'alert' },
      S.banner.text, ' ', S.banner.action || null);
  }

  /* ── Rendering ──────────────────────────────────────────────── */

  function render() {
    App.ui.clear(root);
    root.appendChild(topbar());
    if (S.view === 'loading') root.appendChild(h('div', { class: 'loading' }, t('loading')));
    else if (S.view === 'error') root.appendChild(sheet(h('h2', { class: 'state-title' }, S.loadError), h('button', { type: 'button', class: 'btn btn-quiet', onclick: load }, icon('refresh', 20), t('retry'))));
    else if (S.view === 'closed') root.appendChild(closedView());
    else if (S.view === 'form') root.appendChild(formView());
    else if (S.view === 'keyEntry') root.appendChild(keyEntryView());
    else if (S.view === 'readonly') root.appendChild(readonlyView());
    else if (S.view === 'ticket') root.appendChild(ticketView());
    else if (S.view === 'cancelled') root.appendChild(cancelledView());
  }

  function closedView() {
    var key = { closed: 'closed', not_yet: 'notYet', draft: 'draft', archived: 'closed' }[S.state] || 'closed';
    var msg = S.form.messages && S.form.messages[key] ? L(S.form.messages[key]) : t(key);
    return sheet(head(), h('h2', { class: 'state-title' }, msg), editLink());
  }

  function editLink() {
    if (!S.form.editKey || !S.form.editKey.enabled || !S.form.fields) return null;
    return h('p', { class: 'foot' }, h('button', { type: 'button', class: 'link-btn', onclick: function () { S.view = 'keyEntry'; S.keyError = ''; render(); } }, t('editLink')));
  }

  /** With a key the form is not a path: it opens on the summary, and each page is reached from there and returns to it. */
  function hub() { return S.mode === 'edit'; }
  function changed() { return JSON.stringify(S.data) !== S.original; }

  function formView() {
    var step = S.steps[S.stepIndex];
    var title = h('h2', { class: 'step-title', tabindex: '-1', id: 'step-title' }, step.review ? t(hub() ? 'yourRegistration' : 'reviewTitle') : stepTitle(step));
    var body = step.review ? reviewBody() : step.team ? teamBody() : step.fields.map(function (f) { return renderField(f, f.id); });
    var last = S.stepIndex === S.steps.length - 1;
    var primary = h('button', { type: 'submit', class: 'btn btn-primary', disabled: S.busy }, last ? (S.busy ? t('submitting') : t(S.mode === 'edit' ? 'saveChanges' : keyMode() ? 'book' : 'submit')) : hub() ? t('done') : t(step.team && !S.team ? 'findTeam' : 'next'), last || hub() ? null : icon('arrow', 20));
    // A team that has booked cannot go on, so the button that would take it there is not offered.
    if (step.team && S.team && S.teamBooked) primary = null;
    // Save exists only when an answer differs from the saved registration.
    if (hub() && last && !changed()) primary = h('p', { class: 'help no-changes' }, t('noChanges'));
    var back = S.stepIndex > 0 && !hub() ? h('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { go(S.stepIndex - 1); } }, t('back')) : null;
    // The summary of a registration opened with a key is also the way out of it.
    if (hub() && last) back = closeButton();
    var nav = h('div', { class: 'nav' }, back, primary);
    var help = !step.review ? null : hub() ? t('yourRegistrationHelp') : t(S.form.editKey && S.form.editKey.enabled ? 'reviewHelpKey' : 'reviewHelp');
    var f = h('form', { novalidate: 'novalidate', onsubmit: function (e) { e.preventDefault(); if (!S.busy) next(); } },
      title, help ? h('p', { class: 'step-help' }, help) : null, body, nav);
    var edit = S.mode === 'edit'
      ? h('div', { class: 'banner info', role: 'status' }, t('editing', { ref: S.keyInfo.ref }) + '. ' + t('keyUntil', { date: App.i18n.fmtDate(S.keyInfo.keyExpires) }))
      : null;
    var cancel = S.mode === 'edit' && S.keyInfo.canDelete && last
      ? h('p', { class: 'foot' }, h('button', { type: 'button', class: 'link-btn', onclick: askCancel }, t('cancelReg')))
      : null;
    // A booking made with a team's key starts with that key, so the page asks for a key in one place only:
    // a team that has booked is told so there, with the way to its booking.
    return sheet(head(), edit, hub() ? transferNotes() : null, hub() ? null : trail(), bannerEl(), f, cancel, S.mode === 'new' && S.stepIndex === 0 && !keyMode() ? editLink() : null);
  }

  /* ── Fields ─────────────────────────────────────────────────── */

  function fid(path) { return 'f-' + path.replace(/\./g, '-'); }

  function renderField(field, path) {
    var id = fid(path);
    var control;
    switch (field.type) {
      case 'team_size': control = teamSizeControl(field, path, id); break;
      case 'members': control = membersControl(field, path); break;
      case 'slot': control = slotControl(field, path, id); break;
      case 'select': control = selectControl(field, path, id); break;
      case 'textarea': control = textControl(field, path, id); break;
      default: control = textControl(field, path, id);
    }
    var optional = field.required === false;
    var help = field.help ? L(field.help) : '';
    var node = h('div', { class: 'field', dataset: { path: path } },
      h('label', { class: 'label' + (field.type === 'members' ? ' sr-only' : ''), for: field.type === 'select' && (field.options || []).length <= 4 ? null : id }, L(field.label), optional ? h('span', { class: 'opt' }, '(' + t('optional') + ')') : null),
      // The description sits between the question and the answer, where it is read first.
      help ? h('p', { class: 'help field-desc', id: id + '-help' }, help) : null,
      control,
      folderRule(field),
      h('p', { class: 'error', id: id + '-err', role: 'alert', hidden: true })
    );
    if (S.errors[path]) paintErrorNode(node, S.errors[path]);
    return node;
  }

  /** The folder naming rule under a Drive folder question, with an example from the project title. */
  function folderExample() {
    var fn = S.form.rules && S.form.rules.folderName;
    return Rules.folderNameExample({ project: Rules.valueByRole(S.form, S.data, 'title'), subject: fn && fn.subject });
  }

  function folderRule(field) {
    var fn = S.form.rules && S.form.rules.folderName;
    if (!fn || !fn.enabled || field.type !== 'drive_link' || (field.kinds && field.kinds.indexOf('folder') === -1)) return null;
    return h('p', { class: 'folder-rule' }, icon('info', 16), h('span', { class: 'folder-rule-text' }, t('folderRule', { example: folderExample() })));
  }

  function paintFolderRule() {
    var el = root.querySelector('.folder-rule-text');
    if (el) el.textContent = t('folderRule', { example: folderExample() });
  }

  function paintErrorNode(node, err) {
    var p = node.querySelector(':scope > .error');
    if (!p) return;
    if (err) { node.classList.add('has-error'); p.textContent = App.i18n.err(err); p.hidden = false; }
    else { node.classList.remove('has-error'); p.textContent = ''; p.hidden = true; }
  }

  function paintError(path) {
    var node = root.querySelector('[data-path="' + path + '"]');
    if (node) paintErrorNode(node, S.errors[path]);
  }

  function hint(input, text) {
    var field = input.closest('.field');
    if (!field) return;
    var old = field.querySelector(':scope > .hint');
    if (old) old.remove();
    var el = h('p', { class: 'hint', role: 'status' }, text);
    field.insertBefore(el, field.querySelector(':scope > .error'));
    setTimeout(function () { if (el.parentNode) el.remove(); }, 2400);
  }

  function validateOne(field, path) {
    var v = Rules.validateField(field, getVal(path), { form: S.form });
    if (v.ok) delete S.errors[path];
    else S.errors[path] = { error: v.error, params: v.params };
    paintError(path);
  }

  /** Removes what a field type does not allow while the person types or pastes. */
  function liveFilter(field, input, path) {
    var before = input.value;
    var after = before;
    var message = '';
    if (field.type === 'arabic_name') {
      var c = Rules.cleanArabicName(before, false);
      after = c.value;
      if (c.blocked) message = t('hintArabic');
    } else if (field.type === 'english_text') {
      after = before.replace(/[\u0600-\u06FF\u0750-\u077F]/g, '');
      if (after !== before) message = t('hintEnglish');
    } else if (field.type === 'code') {
      var digits = Rules.latinDigits(before).replace(/\s+/g, '');
      after = digits.replace(/\D/g, '').slice(0, field.length || 7);
      if (digits.replace(/\D/g, '') !== digits) message = t('hintDigits');
    } else if (field.type === 'phone') {
      var d = Rules.latinDigits(before);
      after = d.replace(/[^\d+\s\-()]/g, '');
      if (after !== d) message = t('hintDigits');
    }
    if (after !== before) {
      var pos = input.selectionStart;
      input.value = after;
      try { var np = Math.max(0, (pos == null ? after.length : pos) - (before.length - after.length)); input.setSelectionRange(np, np); } catch (e) { /* not all inputs */ }
    }
    if (message) hint(input, message);
    setVal(path, input.value);
    if (field.role === 'title') paintFolderRule();
    if (S.errors[path]) { delete S.errors[path]; paintError(path); }
  }

  // A hint of the shape of an answer. It must not read as an answer that is already there.
  var PLACEHOLDERS = { email: 'name@example.com', phone: '01xxxxxxxxx', drive_link: 'https://drive.google.com/...' };

  function textControl(field, path, id) {
    var isArea = field.type === 'textarea';
    var attrs = {
      id: id, class: isArea ? 'textarea' : 'input', name: path, value: getVal(path) == null ? '' : String(getVal(path)),
      'aria-describedby': id + '-help ' + id + '-err', autocomplete: 'off', placeholder: PLACEHOLDERS[field.type] || null
    };
    if (!isArea) {
      attrs.type = { email: 'email', phone: 'tel', drive_link: 'url' }[field.type] || 'text';
      if (field.type === 'arabic_name') { attrs.lang = 'ar'; attrs.dir = 'rtl'; attrs.autocomplete = 'name'; }
      else { attrs.dir = 'ltr'; }
      if (field.type === 'code') attrs.inputmode = 'numeric';
      if (field.type === 'phone') { attrs.inputmode = 'tel'; attrs.autocomplete = 'tel'; }
      if (field.type === 'email') { attrs.inputmode = 'email'; attrs.autocomplete = 'email'; attrs.autocapitalize = 'off'; }
      if (field.type === 'code') attrs.maxlength = String(field.length || 7);
    }
    var input = h(isArea ? 'textarea' : 'input', attrs);
    if (isArea) input.value = attrs.value;
    input.addEventListener('input', function () { liveFilter(field, input, path); saveDraft(); });
    input.addEventListener('blur', function () {
      if (field.type === 'phone') { var p = Rules.normalizePhone(input.value); if (p) { input.value = p; setVal(path, p); } }
      if (input.value.trim() !== '' || S.errors[path] || field.required !== false) {
        if (input.value.trim() !== '' || S.errors[path]) validateOne(field, path);
      }
    });
    return input;
  }

  function selectControl(field, path, id) {
    var opts = field.options || [];
    var cur = getVal(path) || '';
    // Only one possible answer (a form limited to one specialization): fill it in.
    if (opts.length === 1 && field.required !== false && String(cur) !== String(opts[0].value)) { cur = opts[0].value; setVal(path, cur); }
    var onPick = function (v) { setVal(path, v); if (S.errors[path]) { delete S.errors[path]; paintError(path); } saveDraft(); };
    if (opts.length <= 4 && opts.length > 0) {
      return h('div', { class: 'chips', role: 'radiogroup', id: id, 'aria-describedby': id + '-err' },
        opts.map(function (o) {
          return h('label', { class: 'chip' },
            h('input', { type: 'radio', name: path, value: o.value, checked: String(cur) === String(o.value), onchange: function () { onPick(o.value); } }),
            h('span', null, L(o.label)));
        }));
    }
    var sel = h('select', { id: id, class: 'select', name: path, 'aria-describedby': id + '-help ' + id + '-err', onchange: function (e) { onPick(e.target.value); } },
      h('option', { value: '' }, t('choose')),
      opts.map(function (o) { return h('option', { value: o.value, selected: String(cur) === String(o.value) }, L(o.label)); }));
    return sel;
  }

  /* ── Team members ───────────────────────────────────────────── */

  function sizeField() {
    var f = Rules.fieldByRole(S.form, 'team_size');
    return f && f.enabled !== false ? f : null;
  }

  function membersField() {
    var f = Rules.fieldByRole(S.form, 'members');
    return f && f.enabled !== false ? f : null;
  }

  function freshMember(mf) {
    var fresh = {};
    (mf.fields || []).forEach(function (sf) {
      if (sf.type === 'select' && S.data[sf.id]) fresh[sf.id] = S.data[sf.id];
    });
    return fresh;
  }

  /** Keeps exactly size - 1 member forms; extra ones are dropped from the end. */
  function syncMembers(size) {
    var mf = Rules.fieldByRole(S.form, 'members');
    if (!mf) return;
    var list = Array.isArray(getVal(mf.id)) ? getVal(mf.id) : [];
    while (list.length > size - 1) list.pop();
    while (list.length < size - 1) list.push(freshMember(mf));
    setVal(mf.id, list);
    S.errors = dropErrors(mf.id);
    delete S.errors[mf.id];
  }

  function scrollToMembers() {
    var el = root.querySelector('.members-wrap');
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* not available */ } }
  }

  /* ── Team size: pick the total, then the member forms appear ── */

  function teamSizeControl(field, path, id) {
    var range = Rules.teamSizeRange(S.form);
    var sizes = [];
    for (var n = range.min; n <= range.max; n++) sizes.push(n);
    var cur = getVal(path);
    if (sizes.length === 1 && !cur) { cur = String(sizes[0]); setVal(path, cur); syncMembers(sizes[0]); }
    var pick = function (n) {
      setVal(path, String(n));
      delete S.errors[path];
      syncMembers(n);
      saveDraft();
      render();
      scrollToMembers();
    };
    var note = cur ? Rules.teamSizeNotice(S.form, cur, App.i18n.lang) : '';
    var noteEl = note ? h('p', { class: 'size-notice', role: 'status' }, icon('info', 18), h('span', null, note)) : null;
    if (sizes.length > 8) {
      return [h('select', { id: id, class: 'select', name: path, 'aria-describedby': id + '-help ' + id + '-err', onchange: function (e) { if (e.target.value) pick(parseInt(e.target.value, 10)); } },
        h('option', { value: '' }, t('choose')),
        sizes.map(function (n) { return h('option', { value: String(n), selected: String(cur) === String(n) }, String(n)); })), noteEl];
    }
    return [h('div', { class: 'chips size-chips', role: 'radiogroup', id: id, 'aria-describedby': id + '-help ' + id + '-err' },
      sizes.map(function (n) {
        return h('label', { class: 'chip' },
          h('input', { type: 'radio', name: path, value: String(n), checked: String(cur) === String(n), onchange: function () { pick(n); } }),
          h('span', null, String(n)));
      })), noteEl];
  }

  /* ── Team members ───────────────────────────────────────────── */

  /** `remove` is given only when the team can lose a member; then the card has the button. */
  function memberCard(field, path, i, remove) {
    var subs = (field.fields || []).filter(function (sf) { return sf.enabled !== false; });
    var head = h('div', { class: 'member-head' },
      h('span', { class: 'member-title' }, t('memberN', { n: i + 1 })),
      remove ? h('button', { type: 'button', class: 'btn btn-quiet', name: 'remove-member-' + i, 'aria-label': t('removeMember') + ' ' + (i + 1), onclick: function () { remove(i); } }, icon('trash', 18), t('removeMember')) : null);
    return h('div', { class: 'member' }, head, subs.map(function (sf) { return renderField(sf, path + '.' + i + '.' + sf.id); }));
  }

  /**
   * The member forms with one remove button each and one add button. `resize(list)` stores the
   * new list; with a team size question it also moves the chosen size, so the two never disagree.
   * A removed member comes back with Undo, because the form it held may have been filled in.
   */
  function memberList(field, path, list, min, max, resize) {
    var commit = function (next, banner) {
      S.errors = dropErrors(path); delete S.errors[path];
      resize(next);
      S.banner = banner || null;
      saveDraft();
      render();
    };
    var remove = list.length > min ? function (i) {
      var before = list.slice();
      commit(list.filter(function (m, k) { return k !== i; }), { kind: 'info', text: t('memberRemoved', { n: i + 1 }),
        action: h('button', { type: 'button', class: 'link-btn', name: 'undo-remove', onclick: function () { commit(before); } }, t('undo')) });
    } : null;
    return [
      list.length ? h('div', { class: 'members' }, list.map(function (m, i) { return memberCard(field, path, i, remove); })) : null,
      list.length ? h('p', { class: 'team-size' }, t('teamSize', { n: list.length + 1 })) : null,
      list.length < max ? h('button', { type: 'button', class: 'btn btn-quiet', name: 'add-member', onclick: function () {
        commit(list.concat([freshMember(field)]));
        var cards = root.querySelectorAll('.member');
        var input = cards.length && cards[cards.length - 1].querySelector('input, select');
        if (input && input.focus) input.focus();
      } }, icon('plus', 20), t('addMember')) : null
    ];
  }

  function membersControl(field, path) {
    var wrap = h('div', { class: 'members-wrap' });
    var sf = sizeField();
    var list = getVal(path);
    if (!Array.isArray(list)) { list = []; setVal(path, list); }
    var range = Rules.teamSizeRange(S.form);

    if (sf) {
      // The chosen team size decides how many member forms are shown; add and remove move it.
      var size = parseInt(S.data[sf.id], 10);
      if (isNaN(size)) {
        wrap.appendChild(h('p', { class: 'help pick-size' }, t('pickSize')));
        return wrap;
      }
      if (list.length !== size - 1) { syncMembers(size); list = getVal(path); }
      if (size === 1) wrap.appendChild(h('p', { class: 'help solo-team' }, t('soloTeam')));
      memberList(field, path, list, range.min - 1, range.max - 1, function (next) {
        setVal(path, next); setVal(sf.id, String(next.length + 1)); delete S.errors[sf.id];
      }).forEach(function (n) { if (n) wrap.appendChild(n); });
      return wrap;
    }

    // Forms without a team size question have only the add and remove buttons.
    var min = field.min == null ? 0 : field.min;
    var max = field.max == null ? range.max - 1 : field.max;
    memberList(field, path, list, min, max, function (next) { setVal(path, next); }).forEach(function (n) { if (n) wrap.appendChild(n); });
    return wrap;
  }

  function dropErrors(prefix) {
    var out = {};
    Object.keys(S.errors).forEach(function (k) { if (k.indexOf(prefix + '.') !== 0) out[k] = S.errors[k]; });
    return out;
  }

  /* ── Slots ──────────────────────────────────────────────────── */

  function slotsTaken(dayId, time) {
    var key = Rules.slotKey(dayId, time);
    var n = S.taken[key] || 0;
    if (S.ownSlot === key) n -= 1;
    return n >= ((S.form.slots && S.form.slots.capacity) || 1);
  }

  function slotControl(field, path, id) {
    var wrap = h('div', { class: 'slot', id: id });
    function paint() {
      App.ui.clear(wrap);
      var days = (S.form.slots && S.form.slots.days) || [];
      var cur = getVal(path) || {};
      var dayChips = days.map(function (d) {
        var full = d.times.every(function (tm) { return slotsTaken(d.id, tm); });
        return h('button', { type: 'button', class: 'slot-chip', disabled: full, 'aria-pressed': cur.day === d.id ? 'true' : 'false', onclick: function () {
          setVal(path, { day: d.id, time: '' }); delete S.errors[path]; paintError(path); saveDraft(); paint();
        } }, d.label, full ? h('small', null, t('slotFull')) : (d.date ? h('small', null, d.date) : null));
      });
      wrap.appendChild(h('div', { class: 'slot-days', role: 'group', 'aria-label': t('slotDay') }, dayChips));
      var day = days.filter(function (d) { return d.id === cur.day; })[0];
      if (!day) { wrap.appendChild(h('p', { class: 'help' }, t('slotPick'))); return; }
      var open = day.times.filter(function (tm) { return !slotsTaken(day.id, tm) || cur.time === tm; });
      if (!open.length) { wrap.appendChild(h('p', { class: 'help' }, t('slotNone'))); return; }
      wrap.appendChild(h('div', { class: 'slot-times', role: 'group', 'aria-label': t('slotTime') }, day.times.map(function (tm) {
        var taken = slotsTaken(day.id, tm) && cur.time !== tm;
        return h('button', { type: 'button', class: 'slot-chip time', disabled: taken, title: taken ? t('slotFull') : null, 'aria-pressed': cur.time === tm ? 'true' : 'false', onclick: function () {
          setVal(path, { day: day.id, time: tm }); delete S.errors[path]; paintError(path); saveDraft(); paint();
        } }, tm);
      })));
    }
    paint();
    return wrap;
  }

  /* ── Review ─────────────────────────────────────────────────── */

  function optionLabel(field, value) {
    var o = (field.options || []).filter(function (x) { return String(x.value) === String(value); })[0];
    return o ? L(o.label) : value;
  }

  function displayValue(field, value) {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return '-';
    if (field.type === 'select') return optionLabel(field, value);
    if (field.type === 'slot') {
      var day = ((S.form.slots && S.form.slots.days) || []).filter(function (d) { return d.id === value.day; })[0];
      return (day ? day.label : value.day) + ' - ' + value.time;
    }
    if (field.type === 'members') {
      return h('ul', { class: 'plain' }, value.map(function (m) {
        return h('li', { class: 'person' }, h('bdi', null, m.name || ''), m.code ? h('span', { class: 'code' }, m.code) : null);
      }));
    }
    if (field.type === 'code') return h('span', { class: 'code' }, value);
    if (field.type === 'team_size') {
      var note = Rules.teamSizeNotice(S.form, value, App.i18n.lang);
      return note ? h('span', null, String(value), h('span', { class: 'size-notice-inline' }, note)) : String(value);
    }
    return String(value);
  }

  function teamRows() {
    var rows = [[t('teamLeader'), S.team.leader], [t('teamCode'), S.team.code]];
    if (S.team.title) rows.push([t('teamProject'), S.team.title]);
    rows.push([t('teamPeople'), S.team.size > 1 ? t('teamPeopleN', { n: S.team.size }) : t('teamSolo')]);
    return rows;
  }

  function teamSummary() {
    return h('dl', { class: 'summary' }, teamRows().map(function (r) { return [h('dt', null, r[0]), h('dd', null, r[1])]; }));
  }

  /** Step one of a key booking: the key, then the team it opens for the student to confirm. */
  function teamBody() {
    if (S.team) {
      return [
        h('p', { class: 'step-help' }, t('teamIs') + ' (' + S.team.ref + ')'),
        teamSummary(),
        S.teamBooked ? h('div', { class: 'banner', role: 'alert' }, t('teamBooked'), ' ',
          // The key that found the team usually opens its booking too; when it does not, the key screen says so.
          h('button', { type: 'button', class: 'link-btn', name: 'open-booking', onclick: function () { S.view = 'keyEntry'; S.keyError = ''; openByKey(S.sourceKey); } }, t('editOpen'))) : null,
        h('p', { class: 'foot' }, h('button', { type: 'button', class: 'link-btn', name: 'other-key', onclick: function () { S.team = null; S.teamBooked = false; S.sourceKey = ''; S.teamKey = ''; S.teamError = ''; render(); } }, t('otherKey')))
      ];
    }
    var input = h('input', { class: 'input key-input', id: 'team-key', type: 'text', inputmode: 'numeric', maxlength: '5', autocomplete: 'off', placeholder: '00000', value: S.teamKey });
    input.addEventListener('input', function () { input.value = S.teamKey = Rules.latinDigits(input.value).replace(/\D/g, '').slice(0, 5); });
    return [
      h('p', { class: 'step-help' }, t('teamHelp', { form: S.form.keyBooking.title })),
      h('div', { class: 'field' + (S.teamError ? ' has-error' : '') }, h('label', { class: 'label', for: 'team-key' }, t('keyLabel')), input,
        h('p', { class: 'error', role: 'alert', hidden: !S.teamError }, S.teamError))
    ];
  }

  async function findTeam() {
    if (!/^\d{5}$/.test(S.teamKey)) { S.teamError = t('errors.bad_key'); render(); return focusFirstError(); }
    S.busy = true; S.teamError = ''; render();
    try {
      var res = await App.api.call({ action: 'bookingTeam', slug: S.slug, key: S.teamKey });
      S.team = res.team; S.teamBooked = !!res.booked; S.sourceKey = S.teamKey;
      S.busy = false;
      render();
      var title = document.getElementById('step-title');
      if (title && title.focus) title.focus({ preventScroll: true });
    } catch (e) {
      S.busy = false;
      S.teamError = App.i18n.err({ error: e.code }) || e.message;
      render(); focusFirstError();
    }
  }

  function summaryList(step) {
    if (step.team) return teamSummary();
    var rows = [];
    step.fields.forEach(function (f) {
      rows.push(h('dt', null, L(f.label)), h('dd', null, displayValue(f, S.data[f.id])));
    });
    return h('dl', { class: 'summary' }, rows);
  }

  function reviewBody() {
    return S.steps.filter(function (s) { return !s.review; }).map(function (s) {
      var i = S.steps.indexOf(s);
      return h('div', { class: 'review-group' },
        h('div', { class: 'member-head' }, h('h3', { class: 'member-title' }, stepTitle(s)),
          h('button', { type: 'button', class: 'link-btn', onclick: function () { go(i); } }, t('change'))),
        summaryList(s));
    });
  }

  function ticketSummary() {
    var rows = [];
    if (S.team && S.form.keyBooking && S.mode === 'new') {
      teamRows().forEach(function (r) { rows.push({ label: r[0], value: r[1] }); });
      var sf = slotField();
      rows.push({ label: L(sf.label), value: displayValue(sf, S.data[sf.id]) });
      return rows;
    }
    S.form.fields.filter(function (f) { return f.enabled !== false && ['name', 'code', 'team_size', 'title', 'slot'].indexOf(f.role) !== -1; }).forEach(function (f) {
      rows.push({ label: L(f.label), value: displayValue(f, S.data[f.id]) });
    });
    var mf = Rules.fieldByRole(S.form, 'members');
    if (mf && Array.isArray(S.data[mf.id]) && S.data[mf.id].length) rows.push({ label: L(mf.label), value: displayValue(mf, S.data[mf.id]) });
    return rows;
  }

  /* ── Navigation and validation ──────────────────────────────── */

  function flatten(errors) {
    var out = {};
    Object.keys(errors || {}).forEach(function (id) {
      var e = errors[id];
      if (e.nested) Object.keys(e.nested).forEach(function (k) { out[id + '.' + k] = e.nested[k]; });
      else out[id] = { error: e.error, params: e.params };
    });
    return out;
  }

  function validateAll() {
    if (keyMode()) {
      // Only the slot is answered here; everything else comes from the registration.
      var sf = slotField(), r = Rules.validateField(sf, S.data[sf.id], { form: S.form }), out = { ok: r.ok, errors: {}, data: {} };
      if (r.ok) out.data[sf.id] = r.value; else out.errors[sf.id] = { error: r.error };
      return out;
    }
    var v = Rules.validateSubmission(S.form, S.data);
    return { ok: v.ok, errors: flatten(v.errors), data: v.data };
  }

  function go(i) {
    S.stepIndex = Math.max(0, Math.min(i, S.steps.length - 1));
    S.banner = null;
    saveDraft();
    render();
    try { window.scrollTo(0, 0); } catch (e) { /* not available */ }
    var title = document.getElementById('step-title');
    if (title && title.focus) title.focus({ preventScroll: true });
  }

  function focusFirstError() {
    var node = root.querySelector('.field.has-error');
    if (!node) return;
    try { node.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* not available */ }
    var input = node.querySelector('input, select, textarea, button');
    if (input && input.focus) input.focus({ preventScroll: true });
  }

  function next() {
    var step = S.steps[S.stepIndex];
    if (step.review) return submit();
    if (step.team) return S.team ? (S.teamBooked ? undefined : go(S.stepIndex + 1)) : findTeam();
    var v = validateAll();
    var ids = step.fields.map(function (f) { return f.id; });
    var stepErrors = {};
    Object.keys(v.errors).forEach(function (k) { if (ids.indexOf(k.split('.')[0]) !== -1) stepErrors[k] = v.errors[k]; });
    Object.keys(S.errors).forEach(function (k) { if (ids.indexOf(k.split('.')[0]) !== -1) delete S.errors[k]; });
    if (Object.keys(stepErrors).length) {
      Object.assign(S.errors, stepErrors);
      S.banner = { kind: 'err', text: t('fixErrors') };
      render();
      focusFirstError();
      return;
    }
    go(hub() ? S.steps.length - 1 : S.stepIndex + 1);
  }

  function showErrorsAndJump(errs) {
    S.errors = errs;
    var first = Object.keys(errs)[0];
    S.stepIndex = first ? stepOfPath(first) : S.stepIndex;
    S.banner = { kind: 'err', text: t('fixErrors') };
    render();
    focusFirstError();
  }

  async function submit() {
    if (keyMode() && !S.team) return go(0);
    var v = validateAll();
    if (!v.ok) return showErrorsAndJump(v.errors);
    S.busy = true;
    S.banner = null;
    render();
    try {
      var res;
      if (S.mode === 'edit') {
        res = await App.api.call({ action: 'update', slug: S.slug, key: S.key, data: v.data, transfer: S.transfer || undefined });
        S.result = { ref: res.ref, edited: true };
      } else {
        var request = { action: 'submit', slug: S.slug, data: v.data, lang: App.i18n.lang, transfer: S.transfer || undefined };
        if (keyMode()) request.sourceKey = S.sourceKey;
        res = await App.api.call(request);
        S.result = { ref: res.ref, key: res.key, keyExpires: res.keyExpires, emailed: !!res.emailed };
      }
      // A member that was asked for from another team is not in the saved answers yet.
      S.data = res.data || v.data;
      S.result.transfers = res.transfers || [];
      S.transfer = null;
      clearDraft();
      S.busy = false;
      S.view = 'ticket';
      render();
      try { window.scrollTo(0, 0); } catch (e) { /* not available */ }
    } catch (e) {
      S.busy = false;
      await handleSubmitError(e);
    }
  }

  async function handleSubmitError(e) {
    var code = e.code;
    var d = e.details || {};
    if (code === 'invalid' && d && typeof d === 'object') {
      var errs = {};
      Object.keys(d).forEach(function (id) {
        var x = d[id];
        if (x && x.nested) Object.keys(x.nested).forEach(function (k) { errs[id + '.' + k] = x.nested[k]; });
        else errs[id] = x;
      });
      return showErrorsAndJump(errs);
    }
    if (code === 'duplicate') {
      var field = d.field || (S.steps[0].fields[0] || {}).id;
      S.errors = {}; S.errors[field] = { error: 'duplicate' };
      S.stepIndex = stepOfPath(field);
      S.banner = { kind: 'err', text: t('errors.duplicate'), action: h('button', { type: 'button', class: 'link-btn', onclick: function () { S.view = 'keyEntry'; S.keyError = ''; S.banner = null; render(); } }, t('editLink')) };
      render(); focusFirstError();
      return;
    }
    if (code === 'already_booked') {
      S.teamBooked = true; S.stepIndex = 0; S.banner = null;
      return render();
    }
    if (code === 'duplicate_member') {
      // Every clashing member can be asked for: offer that before refusing.
      var offer = d.transfer || [];
      if (offer.length && offer.length === (d.codes || []).length && !S.transfer) {
        var ask = await App.ui.confirm({ title: t('transferTitle'), body: t('transferBody', { list: offer.map(function (o) { return who(memberName(o.code), o.code) + ' → ' + o.team; }).join(t('listSep')) }), confirmText: t('transferAsk'), cancelText: t('transferNo') });
        if (ask) { S.transfer = offer.map(function (o) { return o.code; }); return submit(); }
      }
      S.transfer = null;
      S.banner = { kind: 'err', text: t('errors.duplicate_member') + (d.codes ? ' (' + d.codes.join(', ') + ')' : '') };
      S.stepIndex = Math.max(0, S.steps.findIndex(function (s) { return s.fields.some(function (f) { return f.type === 'members'; }); }));
      return render();
    }
    if (code === 'slot_taken') {
      await refreshAvailability();
      var sf = slotField();
      if (sf) { S.data[sf.id] = { day: (S.data[sf.id] || {}).day, time: '' }; S.errors = {}; S.errors[sf.id] = { error: 'slot_taken' }; S.stepIndex = stepOfPath(sf.id); }
      S.banner = { kind: 'err', text: t('errors.slot_taken') };
      return render();
    }
    if (code === 'form_closed' || code === 'form_not_yet' || code === 'form_draft') {
      S.state = { form_closed: 'closed', form_not_yet: 'not_yet', form_draft: 'draft' }[code];
      S.view = 'closed';
      return render();
    }
    S.banner = { kind: 'err', text: App.i18n.err({ error: code }) || e.message };
    render();
  }

  /* ── Edit and cancel with the key ───────────────────────────── */

  function keyEntryView() {
    var input = h('input', { class: 'input key-input', id: 'key-input', type: 'text', inputmode: 'numeric', maxlength: '5', autocomplete: 'one-time-code', 'aria-label': t('keyLabel'), placeholder: '00000' });
    var error = h('p', { class: 'error', role: 'alert', hidden: !S.keyError }, S.keyError);
    input.addEventListener('input', function () { input.value = Rules.latinDigits(input.value).replace(/\D/g, '').slice(0, 5); });
    var f = h('form', { novalidate: 'novalidate', onsubmit: function (e) { e.preventDefault(); openByKey(input.value); } },
      h('h2', { class: 'step-title' }, t('editTitle')),
      h('p', { class: 'step-help' }, t('editHelp')),
      h('div', { class: 'field' }, h('label', { class: 'label', for: 'key-input' }, t('keyLabel')), input, error),
      h('div', { class: 'nav' },
        h('button', { type: 'button', class: 'btn btn-quiet', onclick: function () { S.view = S.state === 'open' ? 'form' : 'closed'; render(); } }, t('backToForm')),
        h('button', { type: 'submit', class: 'btn btn-primary', disabled: S.busy }, t('editOpen'))));
    return sheet(head(), f);
  }

  async function openByKey(key) {
    key = String(key || '').trim();
    if (!/^\d{5}$/.test(key)) { S.keyError = t('errors.bad_key'); return render(); }
    S.busy = true;
    try {
      var res = await App.api.call({ action: 'lookup', slug: S.slug, key: key });
      S.busy = false;
      S.mode = 'edit';
      S.key = key;
      S.keyInfo = { ref: res.submission.ref, keyExpires: res.keyExpires, canEdit: res.canEdit, canDelete: res.canDelete, locked: !!res.locked };
      S.data = res.submission.data || {};
      var sf = slotField();
      S.ownSlot = sf && S.data[sf.id] ? Rules.slotKey(S.data[sf.id].day, S.data[sf.id].time) : '';
      S.errors = {}; S.banner = null;
      S.original = JSON.stringify(S.data);
      S.transfers = res.transfers || { incoming: [], outgoing: [] };
      buildSteps();
      S.stepIndex = S.steps.length - 1;
      S.view = res.canEdit ? 'form' : 'readonly';
      render();
      askTransfers();
    } catch (e) {
      S.busy = false;
      S.keyError = App.i18n.err({ error: e.code }) || e.message;
      render();
    }
  }

  function readonlyView() {
    var groups = S.steps.filter(function (s) { return !s.review; }).map(function (s) { return h('div', null, h('h3', { class: 'member-title' }, stepTitle(s)), summaryList(s)); });
    return sheet(head(),
      h('div', { class: 'banner info', role: 'status' }, t('editing', { ref: S.keyInfo.ref }) + '. ' + t(S.keyInfo.locked ? 'deadlineLocked' : 'readOnly')),
      transferNotes(), bannerEl(),
      groups,
      h('div', { class: 'nav' }, closeButton(), S.keyInfo.canDelete ? h('button', { type: 'button', class: 'btn btn-danger', onclick: askCancel }, icon('trash', 20), t('cancelReg')) : null));
  }

  /** Leaves a registration that was opened with a key. Changes that were not saved are lost only after a yes. */
  function closeButton() {
    var unsaved = S.view === 'form' && changed();
    return h('button', { type: 'button', class: 'btn btn-quiet', name: 'close-edit', onclick: async function () {
      if (unsaved && !(await App.ui.confirm({ title: t('leaveTitle'), body: t('leaveBody'), confirmText: t('leaveYes'), cancelText: t('leaveNo'), danger: true }))) return;
      resetForNew();
    } }, t(unsaved ? 'closeUnsaved' : 'closeEdit'));
  }

  async function askCancel() {
    var yes = await App.ui.confirm({ title: t('cancelTitle'), body: t('cancelBody'), confirmText: t('cancelYes'), cancelText: t('cancelNo'), danger: true });
    if (!yes) return;
    try {
      await App.api.call({ action: 'remove', slug: S.slug, key: S.key });
      S.view = 'cancelled';
      render();
    } catch (e) {
      S.banner = { kind: 'err', text: App.i18n.err({ error: e.code }) || e.message };
      render();
    }
  }

  function cancelledView() {
    return sheet(head(), h('h2', { class: 'state-title' }, t('cancelledTitle')), h('p', null, t('cancelledBody')),
      h('div', { class: 'nav' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { resetForNew(); } }, t('newRegistration'))));
  }

  function resetForNew() {
    S.mode = 'new'; S.key = ''; S.keyInfo = null; S.data = {}; S.errors = {}; S.banner = null; S.stepIndex = 0; S.ownSlot = '';
    S.team = null; S.teamBooked = false; S.sourceKey = ''; S.teamKey = ''; S.teamError = '';
    buildSteps();
    refreshAvailability().then(function () { S.view = S.state === 'open' ? 'form' : 'closed'; render(); });
  }

  function ticketView() {
    var em = Rules.valueByRole(S.form, S.data, 'email');
    var opts = {
      ref: S.result.ref, key: S.result.key, keyExpires: S.result.keyExpires, edited: !!S.result.edited,
      email: !S.result.edited && S.result.emailed ? em : '', summary: ticketSummary()
    };
    var asked = S.result.transfers || [];
    var note = asked.length ? h('div', { class: 'banner info', role: 'status', name: 'transfer-sent' }, t('transferSent', { list: asked.map(function (a) { return who(a.name, a.code) + ' → ' + a.team; }).join(t('listSep')) })) : null;
    return sheet(head(), note, App.ticket.render(opts), App.ticket.actions(opts));
  }

  /* ── Members asked for by, or from, another team ────────────── */

  function who(name, code) { return name ? name + ' (' + code + ')' : String(code); }
  function memberName(code) {
    var mf = Rules.fieldByRole(S.form, 'members');
    var hit = ((mf && S.data[mf.id]) || []).filter(function (m) { return String(m.code) === String(code); })[0];
    return hit ? hit.name : '';
  }

  /** The request as a question with three answers. Resolves to 'approve', 'reject' or 'later'. */
  function transferDialog(r) {
    return new Promise(function (resolve) {
      var done = function (v) { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); resolve(v); };
      var btn = function (cls, name, text, v) { return h('button', { type: 'button', class: 'btn ' + cls, name: name, onclick: function () { done(v); } }, text); };
      var later = btn('btn-quiet', 'transfer-later', t('transferLater'), 'later');
      var overlay = h('div', { class: 'overlay', onclick: function (e) { if (e.target === overlay) done('later'); } },
        h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('transferAskedTitle') },
          h('h2', { class: 'dialog-title' }, t('transferAskedTitle')),
          h('p', null, t('transferAskedBody', { team: r.team, who: who(r.name, r.code) })),
          h('p', { class: 'help' }, t('transferSizeAfter', { n: r.sizeAfter }) + (r.sizeAfter < r.min ? ' ' + t('transferUnderMin', { min: r.min }) : '')),
          h('div', { class: 'dialog-actions transfer-actions' }, later, btn('btn-quiet', 'transfer-reject', t('transferReject'), 'reject'), btn('btn-primary', 'transfer-approve', t('transferApprove'), 'approve'))));
      document.body.appendChild(overlay);
      later.focus();
    });
  }

  async function answerTransfer(r) {
    // An approval replaces the answers on this page with the saved ones, so edits are saved first.
    if (changed()) { S.banner = { kind: 'err', text: t('transferSaveFirst') }; return render(); }
    var answer = await transferDialog(r);
    if (answer === 'later') return;
    try {
      var res = await App.api.call({ action: 'transfer.decide', slug: S.slug, key: S.key, id: r.id, approve: answer === 'approve' });
      S.data = res.submission.data || {};
      S.original = JSON.stringify(S.data);
      S.transfers = res.transfers;
      S.banner = { kind: 'info', text: t(answer === 'approve' ? 'transferApproved' : 'transferRejected', { who: who(r.name, r.code), team: r.team }) };
      buildSteps();
      S.stepIndex = S.steps.length - 1;
    } catch (e) {
      S.banner = { kind: 'err', text: App.i18n.err({ error: e.code }) || e.message };
      try { S.transfers = (await App.api.call({ action: 'lookup', slug: S.slug, key: S.key })).transfers; } catch (x) { /* keep what is shown */ }
    }
    render();
  }

  /** Asks about each waiting request, one after the other, when the registration opens. */
  async function askTransfers() {
    var list = (S.transfers.incoming || []).slice();
    for (var i = 0; i < list.length; i++) await answerTransfer(list[i]);
  }

  async function cancelTransfer(r) {
    try {
      S.transfers = (await App.api.call({ action: 'transfer.cancel', slug: S.slug, key: S.key, id: r.id })).transfers;
    } catch (e) {
      S.banner = { kind: 'err', text: App.i18n.err({ error: e.code }) || e.message };
    }
    render();
  }

  /** One line for each request that waits or was answered, above the registration. */
  function transferNotes() {
    var tr = S.transfers || {};
    var lines = (tr.incoming || []).map(function (r) {
      return h('div', { class: 'banner info transfer-note', role: 'status', dataset: { transfer: 'incoming' } }, t('transferAskedBody', { team: r.team, who: who(r.name, r.code) }), ' ',
        h('button', { type: 'button', class: 'link-btn', name: 'transfer-answer', onclick: function () { answerTransfer(r); } }, t('transferAnswer')));
    }).concat((tr.outgoing || []).map(function (r) {
      var key = { pending: 'transferWaiting', approved: 'transferJoined', rejected: 'transferKept', closed: 'transferElsewhere' }[r.status];
      if (!key) return null;
      return h('div', { class: 'banner info transfer-note', role: 'status', dataset: { transfer: r.status } }, t(key, { team: r.team, who: who(r.name, r.code) }), ' ',
        r.status === 'pending' ? h('button', { type: 'button', class: 'link-btn', name: 'transfer-cancel', onclick: function () { cancelTransfer(r); } }, t('transferCancel')) : null);
    })).filter(Boolean);
    return lines.length ? h('div', { class: 'transfer-notes' }, lines) : null;
  }

  /* ── Start ──────────────────────────────────────────────────── */

  App.form = { init: init, _state: S };

  function init() {
    var params = new URLSearchParams(window.location.search);
    S.slug = (params.get('f') || window.location.hash.replace('#', '') || '').trim();
    if (!S.slug) {
      S.loadError = t('notFound');
      S.view = 'error';
      return render();
    }
    return load();
  }

  if (!window.__FORM_NO_AUTOSTART__) init();
})(window.App = window.App || {});
