/**
 * Admin: the shared lists behind dropdown questions (levels, majors, sections...).
 *
 * The lists are at the side and the choices of the picked list are in the main part. A list
 * of plain values is shown as chips; a list whose choices have English names is shown as rows.
 * The save bar exists only while the picked list differs from its saved copy.
 */
(function (App) {
  'use strict';
  var A = App.admin, ui = App.ui, h = ui.h, icon = ui.icon, toast = ui.toast;

  /** What each shared list is for, and which form types ask it by default. */
  var LIST_INFO = {
    levels: { name: 'Levels', about: 'The level or year question.', types: ['team_registration', 'task_submission', 'reservation', 'whatsapp_registration'] },
    curricula: { name: 'Bylaws', about: 'The bylaw (curriculum year) question.', types: ['team_registration', 'task_submission', 'reservation'] },
    majors: { name: 'Majors', about: 'Specializations. A form can also be limited to some of them in its setup.', types: ['team_registration', 'task_submission', 'reservation', 'whatsapp_registration'] },
    sections: { name: 'Sections', about: 'Lecture sections such as 4C-TH1. A form can also be limited to some of them in its setup.', types: ['team_registration', 'task_submission', 'reservation'] },
    groups: { name: 'Groups', about: 'WhatsApp group letters (A with Chemistry, B without).', types: ['whatsapp_registration'] },
    wa_sections: { name: 'WhatsApp section numbers', about: 'The number next to TH in a student timetable.', types: ['whatsapp_registration'] }
  };
  var PEEK = 4; // Choices named on the card of a list.

  function listName(key) { return (LIST_INFO[key] && LIST_INFO[key].name) || key; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /** Forms whose questions (or member questions) read this list. */
  function formsUsing(forms, key) {
    return forms.filter(function (f) {
      var uses = function (fields) { return (fields || []).some(function (x) { return x.list === key || uses(x.fields); }); };
      return f.status !== 'archived' && uses(f.fields);
    });
  }

  /** A saved choice as the editor holds it: a name that only repeats the value is left empty. */
  function toRows(values) {
    return (values || []).map(function (o) {
      var label = o.label || {};
      return { value: String(o.value), en: label.en && label.en !== String(o.value) ? label.en : '', ar: label.ar && label.ar !== String(o.value) ? label.ar : '' };
    });
  }

  function fromRows(rows) {
    return rows.filter(function (r) { return r.value.trim(); }).map(function (r) {
      var v = r.value.trim();
      return { value: v, label: { en: r.en.trim() || v, ar: r.ar.trim() || v } };
    });
  }

  /** Lines of pasted text as rows; "value | English name" gives the choice a name. */
  function parse(text) {
    return String(text).split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var i = l.indexOf('|');
      return i === -1 ? { value: l, en: '', ar: '' } : { value: l.slice(0, i).trim(), en: l.slice(i + 1).trim(), ar: '' };
    }).filter(function (r) { return r.value; });
  }

  A.views.lists = async function (mount, picked) {
    var both = await Promise.all([A.call('admin.lists.get'), A.call('admin.forms.list')]);
    var lists = both[0].lists;
    var forms = both[1].forms;
    var keys = Object.keys(lists);
    // `open` is false while the address names no list: a phone then shows only the lists.
    var st = { key: keys.indexOf(picked) !== -1 ? picked : keys[0], open: keys.indexOf(picked) !== -1, rows: [], order: false };

    var index = h('nav', { class: 'l-side lists-index l-stack', 'aria-label': 'Lists' });
    var pane = h('section', { class: 'l-main panel list-pane' });
    var wrap = h('div', { class: 'lists l-split' }, index, pane);
    var rowsBox = h('div', { class: 'list-rows' });
    var problemBox = h('p', { class: 'error', role: 'alert', hidden: true });
    var barNote = h('span', { class: 'savebar-note', role: 'status' });
    var barWarn = h('span', { class: 'savebar-warn' });
    var saveBtn = h('button', { type: 'button', class: 'btn btn-primary', name: 'save-list' });
    var bar = h('div', { class: 'savebar', hidden: true }, h('span', { class: 'savebar-text' }, barNote, barWarn),
      h('button', { type: 'button', class: 'btn btn-quiet', name: 'discard', onclick: function () { load(st.key); paint(); } }, 'Discard'), saveBtn);

    function load(key) { st.key = key; st.rows = toRows(lists[key]); st.order = false; }
    function dirty() { return JSON.stringify(fromRows(st.rows)) !== JSON.stringify(fromRows(toRows(lists[st.key]))) || st.rows.some(function (r) { return !r.value.trim() && (r.en.trim() || r.ar.trim()); }); }
    function named() { return st.rows.some(function (r) { return r.en || r.ar; }); }
    /** Rows are needed for names and order; plain values read best as chips. */
    function asRows() { return st.order || named(); }

    /** The first thing that stops a save, or ''. `at` is the row to mark. */
    function problem() {
      var seen = {}, out = { text: '', at: -1 };
      st.rows.some(function (r, i) {
        var v = r.value.trim();
        if (!v && (r.en.trim() || r.ar.trim())) out = { text: 'Choice ' + (i + 1) + ' has a name but no value. Write the choice or remove the row.', at: i };
        else if (v && seen[v]) out = { text: '"' + v + '" is in the list twice. Remove one of them.', at: i };
        seen[v] = true;
        return out.text;
      });
      if (!out.text && !fromRows(st.rows).length) out.text = 'A list needs at least one choice.';
      return out;
    }

    /** What a save would change, in words. */
    function changes() {
      var before = (lists[st.key] || []).map(function (o) { return String(o.value); });
      var now = fromRows(st.rows).map(function (o) { return o.value; });
      var added = now.filter(function (v) { return before.indexOf(v) === -1; });
      var removed = before.filter(function (v) { return now.indexOf(v) === -1; });
      var parts = [];
      if (added.length) parts.push(added.length + ' added');
      if (removed.length) parts.push(removed.length + ' removed');
      if (!parts.length) parts.push('names or order changed');
      // A form limited to some values of this list (rules.majors, rules.sections) loses a removed one.
      var limited = forms.filter(function (f) { return ((f.rules || {})[st.key] || []).some(function (v) { return removed.indexOf(String(v)) !== -1; }); });
      return { text: parts.join(', '), limited: limited };
    }

    /** Paints everything that depends on the rows without touching the inputs being typed in. */
    function changed() {
      var isDirty = dirty(), bad = problem();
      A.unsaved = isDirty;
      bar.hidden = !isDirty;
      problemBox.hidden = !(isDirty && bad.text);
      problemBox.textContent = bad.text;
      Array.prototype.forEach.call(rowsBox.querySelectorAll('[data-i]'), function (el) { el.classList.toggle('bad', isDirty && +el.dataset.i === bad.at); });
      if (isDirty) {
        var c = changes();
        barNote.textContent = listName(st.key) + ': ' + c.text + '. Not saved yet.';
        barWarn.textContent = c.limited.length ? 'Limited to a removed choice: ' + c.limited.map(function (f) { return f.title; }).join(', ') + '.' : '';
        saveBtn.textContent = 'Save ' + listName(st.key);
      }
      paintIndex();
    }

    async function select(key) {
      if (key !== st.key && dirty()) {
        var leave = await ui.confirm({ title: 'Leave without saving?', body: 'Your changes to ' + listName(st.key) + ' are not saved.', confirmText: 'Leave', danger: true });
        if (!leave) return;
      }
      if (key !== st.key) load(key);
      st.open = true;
      A.setHash('#/lists/' + encodeURIComponent(key));
      paint();
    }

    saveBtn.addEventListener('click', function () {
      A.busy(saveBtn, async function () {
        if (problem().text) { changed(); if (problemBox.scrollIntoView) problemBox.scrollIntoView({ block: 'center' }); return; }
        var out = await A.call('admin.lists.set', { key: st.key, values: fromRows(st.rows) });
        lists = out.lists;
        load(st.key);
        toast(listName(st.key) + ' saved. Every form that uses it shows the new choices.', 'ok');
        paint();
      });
    });

    function paintIndex() {
      ui.clear(index);
      keys.forEach(function (k) {
        var current = k === st.key;
        var values = current ? fromRows(st.rows) : (lists[k] || []);
        var users = formsUsing(forms, k).length;
        var peek = values.slice(0, PEEK).map(function (o) { return (o.label && o.label.en) || o.value; }).join(', ') + (values.length > PEEK ? ' …' : '');
        index.appendChild(h('button', { type: 'button', class: 'list-card', name: 'pick-' + k, 'aria-current': current ? 'true' : null, onclick: function () { select(k); } },
          h('span', { class: 'list-card-name' }, listName(k), current && dirty() ? h('span', { class: 'badge draft' }, 'Not saved') : null),
          h('span', { class: 'list-card-peek', dir: 'auto' }, peek || 'No choices yet'),
          h('span', { class: 'list-card-meta' }, plural(values.length, 'choice', 'choices') + ' · ' + (users ? plural(users, 'form', 'forms') : 'no form yet'))));
      });
    }

    function removeRow(i) { st.rows.splice(i, 1); paintRows(); changed(); }

    function rowEl(r, i) {
      var move = function (d) { var j = i + d; var t = st.rows[i]; st.rows[i] = st.rows[j]; st.rows[j] = t; paintRows(); changed(); };
      var edit = function (key) { return function (v) { r[key] = v; changed(); }; };
      return h('li', { class: 'choice', dataset: { i: String(i) } },
        h('span', { class: 'choice-n' }, String(i + 1)),
        A.text(r.value, edit('value'), { class: 'input', name: 'value-' + i, 'aria-label': 'Choice ' + (i + 1), dir: 'auto' }),
        A.text(r.en, edit('en'), { class: 'input choice-en', name: 'en-' + i, 'aria-label': 'English name of choice ' + (i + 1), placeholder: 'English name', dir: 'ltr' }),
        // An Arabic name that differs from the value is rare; its column exists only for a list that has one.
        st.withAr ? A.text(r.ar, edit('ar'), { class: 'input choice-ar', name: 'ar-' + i, 'aria-label': 'Arabic name of choice ' + (i + 1), placeholder: 'الاسم بالعربية', dir: 'rtl', lang: 'ar' }) : null,
        h('span', { class: 'choice-tools' },
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Move up', disabled: i === 0, onclick: function () { move(-1); } }, '↑'),
          h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Move down', disabled: i === st.rows.length - 1, onclick: function () { move(1); } }, '↓'),
          h('button', { type: 'button', class: 'icon-btn sm danger', name: 'remove-' + i, 'aria-label': 'Remove ' + (r.value || 'this choice'), onclick: function () { removeRow(i); } }, icon('trash', 16))));
    }

    function chipEl(r, i) {
      return h('li', { class: 'value-chip', dataset: { i: String(i) } }, h('span', { dir: 'auto' }, r.value),
        h('button', { type: 'button', name: 'remove-' + i, 'aria-label': 'Remove ' + r.value, onclick: function () { removeRow(i); } }, icon('x', 14)));
    }

    function paintRows() {
      ui.clear(rowsBox);
      st.withAr = st.rows.some(function (r) { return r.ar; });
      var rows = asRows();
      if (!st.rows.length) rowsBox.appendChild(h('div', { class: 'empty' }, h('strong', null, 'No choices yet.'), ' Add the first one below.'));
      else if (!rows) rowsBox.appendChild(h('ul', { class: 'value-chips' }, st.rows.map(chipEl)));
      else {
        rowsBox.appendChild(h('div', { class: 'choice-head' + (st.withAr ? ' with-ar' : ''), 'aria-hidden': 'true' }, h('span'), h('span', null, 'Choice'), h('span', null, 'English name'), st.withAr ? h('span', null, 'Arabic name') : null, h('span')));
        rowsBox.appendChild(h('ol', { class: 'choices' + (st.withAr ? ' with-ar' : '') }, st.rows.map(rowEl)));
      }
      rowsBox.appendChild(adder(rows));
      // Chips cannot rename or reorder, so a plain list offers the rows; rows of a plain list offer the way back.
      if (st.rows.length && !named()) rowsBox.appendChild(h('button', { type: 'button', class: 'link-btn', name: rows ? 'short-view' : 'edit-rows', onclick: function () { st.order = !rows; paintRows(); changed(); } },
        rows ? 'Back to the short view' : 'Rename, reorder or add English names'));
    }

    function adder(rows) {
      var v = h('input', { class: 'input', name: 'new-value', placeholder: 'New choice', dir: 'auto', 'aria-label': 'New choice' });
      var en = rows ? h('input', { class: 'input', name: 'new-en', placeholder: 'English name (optional)', dir: 'ltr', 'aria-label': 'English name of the new choice' }) : null;
      var add = function () {
        if (!v.value.trim()) return v.focus();
        st.rows.push({ value: v.value.trim(), en: en ? en.value.trim() : '', ar: '' });
        paintRows(); changed();
        var next = rowsBox.querySelector('[name="new-value"]'); if (next && next.focus) next.focus();
      };
      [v, en].forEach(function (x) { if (x) x.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } }); });
      return h('div', { class: 'choice-add' + (rows ? '' : ' short') }, v, en, h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'add-choice', onclick: add }, icon('plus', 18), 'Add'));
    }

    /** Many choices in one step: pasted lines, or a run of numbers for a list of numbers. */
    function many() {
      var paste = h('textarea', { class: 'textarea', rows: '5', name: 'paste-list', placeholder: 'One choice on each line. For an English name, add a bar:\nحاسبات | Computers', 'aria-label': 'Choices, one on each line' });
      var pasteActs = h('div', { class: 'actions' });
      var use = function (replace) { return function () { st.rows = (replace ? [] : st.rows).concat(parse(paste.value)); paste.value = ''; paintRows(); changed(); paintActs(); }; };
      function paintActs() {
        ui.clear(pasteActs);
        var n = parse(paste.value).length;
        if (!n) return;
        pasteActs.appendChild(h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'paste-add', onclick: use(false) }, 'Add ' + plural(n, 'choice', 'choices') + ' to the end'));
        if (st.rows.length) pasteActs.appendChild(h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'paste-replace', onclick: use(true) }, 'Replace the list with ' + (n === 1 ? 'it' : 'them')));
      }
      paste.addEventListener('input', paintActs);

      var numeric = st.rows.every(function (r) { return /^\d+$/.test(r.value); });
      var from = h('input', { class: 'input num', type: 'number', inputmode: 'numeric', name: 'range-from', value: '1', 'aria-label': 'First number' });
      var to = h('input', { class: 'input num', type: 'number', inputmode: 'numeric', name: 'range-to', value: String(Math.max(st.rows.length, 1)), 'aria-label': 'Last number' });
      var rangeErr = h('span', { class: 'error', role: 'alert' });
      var range = numeric ? h('div', { class: 'list-range' },
        h('span', { class: 'label' }, 'Or number them'), h('span', null, 'from'), from, h('span', null, 'to'), to,
        h('button', { type: 'button', class: 'btn btn-quiet sm', name: 'fill-range', onclick: function () {
          var a = parseInt(from.value, 10), b = parseInt(to.value, 10);
          rangeErr.textContent = !(a >= 0) || !(b >= a) ? 'The last number must not be before the first.' : b - a > 300 ? 'That is more than 300 choices. Use a shorter run.' : '';
          if (rangeErr.textContent) return;
          st.rows = []; for (var n = a; n <= b; n++) st.rows.push({ value: String(n), en: '', ar: '' });
          paintRows(); changed();
        } }, st.rows.length ? 'Replace the list' : 'Fill the list'), rangeErr) : null;
      return h('details', { class: 'list-many', name: 'add-many' }, h('summary', null, 'Add many at once'), paste, pasteActs, range);
    }

    function paintPane() {
      ui.clear(pane);
      var info = LIST_INFO[st.key] || { about: '', types: [] };
      var users = formsUsing(forms, st.key);
      pane.dataset.list = st.key;
      pane.appendChild(h('button', { type: 'button', class: 'link-btn lists-back', name: 'all-lists', onclick: function () { st.open = false; A.setHash('#/lists'); paint(); } }, '‹ All lists'));
      pane.appendChild(h('div', { class: 'list-head' },
        h('h2', null, listName(st.key)),
        info.about ? h('p', { class: 'help' }, info.about) : null,
        h('p', { class: 'used-by' }, users.length ? users.reduce(function (out, f, i) {
          return out.concat(i ? ', ' : [], h('a', { href: '#/f/' + encodeURIComponent(f.slug) + '/questions' }, f.title));
        }, ['Asked by ']) : 'No form asks it yet.' + (info.types.length ? ' A new ' + info.types.map(function (t) { return (A.TYPES[t] || { label: t }).label.toLowerCase(); }).join(', ') + ' form will.' : ''))));
      paintRows();
      pane.appendChild(rowsBox);
      pane.appendChild(problemBox);
      pane.appendChild(many());
      pane.appendChild(h('p', { class: 'muted-note' }, 'A save reaches every form that asks this list. Answers already given are not changed.'));
    }

    function paint() { wrap.classList.toggle('picked', st.open); paintPane(); changed(); }

    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Lists')));
    mount.appendChild(h('p', { class: 'help' }, 'The choices of the dropdown questions. A list is shared: change it here and every form that asks it follows.'));
    if (!keys.length) return mount.appendChild(h('div', { class: 'empty' }, 'No lists yet.'));
    load(st.key);
    mount.appendChild(wrap);
    mount.appendChild(bar);
    paint();
  };
})(window.App = window.App || {});
