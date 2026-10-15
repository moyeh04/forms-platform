/**
 * The Details dialog of a submission: every answer, the edit key, the
 * review steps, and the buttons that reset the key or delete it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var R = A.responses;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  /** Where the key rows go: after the reference and the date sent. */
  var KEY_ROWS_AT = 4;

  /**
   * Draws an answer the way its question needs.
   *
   * @param {!Object} form The form.
   * @param {!Object} f The question.
   * @param {*} v The answer.
   * @return {*} The answer as shown.
   */
  function answerNode(form, f, v) {
    if (f.type === 'members') {
      return h(
        'div',
        null,
        v.map(function (m) {
          return h(
            'div',
            null,
            R.bdi(m.name),
            ' ',
            h('span', { class: 'mono' }, m.code),
            ' ',
            h('span', { class: 'mono' }, m.phone)
          );
        })
      );
    }
    if (f.type === 'slot') return R.slotText(form, v);
    if (f.type === 'drive_link') {
      return h(
        'a',
        { href: v, target: '_blank', rel: 'noopener' },
        'Open link'
      );
    }
    if (f.type === 'arabic_name') return R.bdi(v);
    return String(v);
  }

  /**
   * Whether an answer is left out: an empty one, or the teammates of a
   * booking when the form does not ask for them.
   *
   * @param {!Object} form The form.
   * @param {!Object} f The question.
   * @param {*} v The answer.
   * @return {boolean} True to leave it out.
   */
  function skipped(form, f, v) {
    if (
      form.type === FormType.RESERVATION &&
      f.role === 'members' &&
      f.enabled === false
    ) {
      return true;
    }
    return v === undefined || v === '' || (Array.isArray(v) && !v.length);
  }

  /**
   * Draws the reference, the date sent and every answer as rows.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @return {!Array<!Element>} The rows.
   */
  function answerRows(form, s) {
    var rows = [
      h('dt', null, 'Reference'),
      h('dd', null, s.ref),
      h('dt', null, 'Sent'),
      h('dd', null, A.fmtDate(s.created))
    ];
    (form.fields || []).forEach(function (f) {
      var v = s.data[f.id];
      if (skipped(form, f, v)) return;
      rows.push(
        h('dt', null, f.label.en),
        h('dd', null, answerNode(form, f, v))
      );
    });
    return rows;
  }

  /**
   * Makes a new key and shows it once.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {?Object} key The key rows, or null when the form has none.
   * @return {!Promise<boolean>} False to keep the dialog open.
   */
  async function resetKey(form, s, key) {
    var r = await A.call('admin.submission.resetKey', {
      slug: form.slug,
      submissionId: s.id
    });
    s.keyKnown = true;
    s.keyExpires = r.keyExpires;
    if (key) key.paintUntil();
    A.reveal(
      'New key for ' + r.ref,
      'Give this key to the student. They open the form link and choose' +
        ' "Edit or cancel with your key". It works until ' +
        A.fmtDate(r.keyExpires) +
        '. The old key stops working. You can see it again any time under' +
        ' Details.',
      r.key,
      true
    );
    return false;
  }

  /**
   * Deletes the submission after a confirmation.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {function()} reload Draws the page again.
   * @param {function()} close Closes the dialog.
   * @return {!Promise<boolean>} False, as the dialog is already closed.
   */
  async function remove(form, s, reload, close) {
    close();
    var ok = await ui.confirm({
      title: 'Delete ' + s.ref + '?',
      body:
        'This frees its code' +
        (s.slot ? ' and its slot' : '') +
        ' so the team can register again.',
      confirmText: 'Delete',
      danger: true
    });
    if (!ok) return false;
    await A.call('admin.submission.delete', {
      slug: form.slug,
      submissionId: s.id
    });
    toast('Deleted', 'ok');
    reload();
    return false;
  }

  /**
   * Opens the Details dialog of a submission.
   *
   * @param {!Object} form The form.
   * @param {!Object} s The submission.
   * @param {function()} reload Draws the page again.
   */
  R.details = function (form, s, reload) {
    var rows = answerRows(form, s);
    var key = form.editKey?.enabled ? R.keyRows(form, s) : null;
    if (key) rows.splice(KEY_ROWS_AT, 0, ...key.rows);
    var steps = (form.review?.steps || []).map(function (st) {
      return h(
        'div',
        { class: 'row' },
        A.field(st.label.en, R.reviewSelect(form, s, st))
      );
    });
    var body = h('div', { class: 'detail' }, h('dl', null, rows), steps);
    A.modal('Registration ' + s.ref, body, [
      {
        text: 'Reset key',
        kind: 'quiet',
        onclick: resetKey.bind(null, form, s, key)
      },
      {
        text: 'Delete',
        kind: 'danger',
        onclick: remove.bind(null, form, s, reload)
      },
      { text: 'Close', kind: 'quiet' }
    ]);
  };
})(window.App);
