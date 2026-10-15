/**
 * The Extend keys dialog: gives registration keys more time. About chosen
 * registrations, or, from Setup, the admin picks: all keys, the expired
 * ones, those ending soon, or chosen teams.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;
  var clear = App.ui.clear;

  /** The periods a key can be given. */
  var KEY_PERIODS = [
    { days: 3, label: '3 more days' },
    { days: 7, label: '1 more week' },
    { days: 14, label: '2 more weeks' },
    { days: 30, label: '1 more month' }
  ];

  /** The period picked when the dialog opens. */
  var DEFAULT_DAYS = 7;

  /** A key ending within this many days is ending soon. */
  var SOON_DAYS = 3;

  /**
   * Says whether a working key ends soon.
   *
   * @param {!Object} k The key.
   * @return {boolean} True when it does.
   */
  function endsSoon(k) {
    return (
      !k.expired &&
      !!k.keyExpires &&
      Date.parse(k.keyExpires) - Date.now() < SOON_DAYS * A.DAY_MS
    );
  }

  /**
   * Lists the keys the dialog would extend now.
   *
   * @param {!Object} v The dialog.
   * @return {!Array<!Object>} The keys.
   */
  function picked(v) {
    if (v.fixed) return v.fixed;
    if (v.which === 'chosen') {
      return v.keys.filter(function (k) {
        return v.chosen.indexOf(k.id) !== -1;
      });
    }
    return v.groups[v.which];
  }

  /**
   * Writes the line that says until when the keys will work.
   *
   * @param {!Object} v The dialog.
   * @param {!Array<!Object>} list The keys extended.
   * @return {!Element} The line.
   */
  function untilLine(v, list) {
    var ends = list
      .map(function (k) {
        return A.extendedEnd(k.keyExpires, v.choice);
      })
      .sort();
    var first = A.day(ends[0]);
    var last = A.day(ends[ends.length - 1]);
    return h(
      'strong',
      null,
      (list.length > 1
        ? A.plural(list.length, 'key', 'keys') + ' will work until '
        : 'The key will work until ') +
        (first === last ? first : first + ' to ' + last) +
        '.'
    );
  }

  /**
   * Writes how many expired keys work again.
   *
   * @param {!Array<!Object>} list The keys extended.
   * @return {string} The words, or '' when none had ended.
   */
  function revivedText(list) {
    var revived = list.filter(function (k) {
      return k.expired;
    }).length;
    if (!revived) return '';
    return (
      ' ' +
      (list.length > 1
        ? A.plural(revived, 'expired key works', 'expired keys work')
        : 'The expired key works') +
      ' again.'
    );
  }

  /**
   * Says what the Extend button would do, and enables it only when it can
   * act.
   *
   * @param {!Object} v The dialog.
   */
  function paintPreview(v) {
    var list = picked(v);
    clear(v.preview);
    if (v.goBtn) {
      v.goBtn.disabled = !(list.length && v.choice);
      v.goBtn.textContent =
        list.length > 1 ? 'Extend ' + list.length + ' keys' : 'Extend key';
    }
    if (!list.length) {
      v.preview.append(
        v.which === 'chosen' ? 'Choose at least one team.' : 'No keys here.'
      );
      return;
    }
    if (!v.choice) {
      v.preview.append('Pick the date the keys end.');
      return;
    }
    v.preview.append(untilLine(v, list), revivedText(list));
    if (v.choice.days) {
      v.preview.appendChild(
        h(
          'span',
          { class: 'help' },
          'Time is added from today, or from a key' +
            "'s end date when that is later."
        )
      );
    }
  }

  /**
   * Writes how many keys are given and how many have ended.
   *
   * @param {!Object} v The dialog.
   * @return {string} The sentence.
   */
  function summary(v) {
    var given = A.plural(v.keys.length, 'key', 'keys') + ' given';
    var expired = v.groups.expired.length;
    if (!expired) return given + ', all working.';
    return (
      given +
      ': ' +
      (v.keys.length - expired) +
      ' working, ' +
      expired +
      ' expired.'
    );
  }

  /**
   * Draws the body about chosen registrations: where the one key ends,
   * and how long to give.
   *
   * @param {!Object} v The dialog.
   * @return {!Element} The body.
   */
  function fixedBody(v) {
    var one = v.fixed.length === 1 ? v.fixed[0] : null;
    var where = null;
    if (one) {
      where = h(
        'p',
        null,
        'The key of ',
        h('span', { class: 'mono' }, one.ref),
        one.expired
          ? h(
              'span',
              { class: 'warn-text' },
              ' ended on ' + A.day(one.keyExpires)
            )
          : ' works until ' + A.day(one.keyExpires),
        '.'
      );
    }
    return h(
      'div',
      { class: 'l-stack extend-keys' },
      where,
      h('span', { class: 'label' }, 'Give it'),
      v.picker.node,
      v.preview
    );
  }

  /**
   * Draws the body where the admin picks the keys.
   *
   * @param {!Object} v The dialog.
   * @return {!Element} The body.
   */
  function chooseBody(v) {
    A.paintKeyWhich(v);
    A.paintKeyList(v);
    return h(
      'div',
      { class: 'l-stack extend-keys' },
      h('p', null, summary(v)),
      h('span', { class: 'label' }, 'Which keys'),
      v.whichBox,
      v.listBox,
      h('span', { class: 'label' }, 'Give them'),
      v.picker.node,
      v.preview
    );
  }

  /**
   * Sends the extension and reports it.
   *
   * @param {!Object} v The dialog.
   * @param {!Object} form The form.
   * @param {function(!Array<!Object>)=} done Called with every key's new
   *     state.
   * @return {!Promise} Settles when it is saved.
   */
  async function send(v, form, done) {
    var req = { slug: form.slug };
    if (v.fixed || v.which === 'chosen' || v.which === 'soon') {
      req.which = 'chosen';
      req.ids = picked(v).map(function (k) {
        return k.id;
      });
    } else req.which = v.which;
    if (v.choice.until) req.until = v.choice.until;
    else req.days = v.choice.days;
    var r = await A.call('admin.keys.extend', req);
    App.ui.toast(
      r.changed === 1 ? 'Key extended' : r.changed + ' keys extended',
      'ok'
    );
    if (done) done(r.keys);
  }

  /**
   * Makes the state of the dialog and its controls.
   *
   * @param {!Array<!Object>} keys Every key of the form.
   * @param {?Array<string>} ids The registrations it is about, if chosen.
   * @return {!Object} The dialog.
   */
  function makeDialog(keys, ids) {
    var groups = {
      all: keys,
      expired: keys.filter(function (k) {
        return k.expired;
      }),
      soon: keys.filter(endsSoon)
    };
    var v = {
      keys: keys,
      groups: groups,
      fixed: ids
        ? keys.filter(function (k) {
            return ids.indexOf(k.id) !== -1;
          })
        : null,
      which: groups.expired.length ? 'expired' : 'all',
      chosen: [],
      search: '',
      choice: { days: DEFAULT_DAYS },
      whichBox: h('div', {
        class: 'toggle-chips',
        role: 'group',
        'aria-label': 'Which keys'
      }),
      listBox: h('div', { class: 'key-choose' }),
      rowsBox: h('div', {
        class: 'key-rows',
        role: 'group',
        'aria-label': 'Teams'
      }),
      preview: h('p', { class: 'extend-preview', role: 'status' })
    };
    v.searchInput = h('input', {
      class: 'input',
      type: 'search',
      name: 'key-search',
      placeholder: 'Find a team by reference, name or title',
      'aria-label': 'Find a team',
      oninput: function (e) {
        v.search = e.target.value.trim().toLowerCase();
        A.paintKeyRows(v);
      }
    });
    v.changed = paintPreview.bind(null, v);
    v.picker = A.untilPicker({
      name: 'extend',
      periods: KEY_PERIODS,
      start: v.choice,
      onchange: function (c) {
        v.choice = c;
        paintPreview(v);
      }
    });
    return v;
  }

  /**
   * Opens the Extend keys dialog.
   *
   * @param {!Object} form The form.
   * @param {!Object=} opts `ids`: the registrations it is about only;
   *     `done(keys)`: runs after a change, with every key's new state.
   * @return {!Promise<!Object>} The dialog.
   */
  A.extendKeys = async function (form, opts) {
    var o = opts || {};
    var keys = (await A.call('admin.keys.list', { slug: form.slug })).keys;
    var v = makeDialog(keys, o.ids);
    var body = v.fixed ? fixedBody(v) : chooseBody(v);

    /**
     * Sends the extension.
     *
     * @return {!Promise} Settles when it is saved.
     */
    function extend() {
      return send(v, form, o.done);
    }

    var dialog = A.modal(
      v.fixed ? 'Extend the edit key' : 'Extend edit keys',
      body,
      [
        { text: 'Cancel', kind: 'quiet' },
        { text: 'Extend', kind: 'primary', onclick: extend }
      ]
    );
    v.goBtn = dialog.el.querySelector('.dialog-actions .btn-primary');
    v.goBtn.name = 'extend-go';
    paintPreview(v);
    return dialog;
  };
})(window.App);
