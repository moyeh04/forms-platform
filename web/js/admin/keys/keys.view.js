/**
 * Admin: when keys and private links stop working. One picker for "how long" serves the
 * Clients page, a registration's details and the bulk Extend keys dialog, so the three read
 * the same way.
 */
(function (App) {
  'use strict';

  var ui = App.ui,
    h = ui.h,
    icon = ui.icon,
    toast = ui.toast,
    A = App.admin;
  var DAY = 86400000;

  /** "14 Oct 2026": a date people read at a glance. */
  A.day = function (iso) {
    var d = new Date(iso);
    return isNaN(d)
      ? ''
      : d.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
  };

  function ended(iso) {
    return !!(iso && Date.parse(iso) < Date.now());
  }

  /** "Until 14 Oct 2026", "Ended 2 Oct 2026" (marked) or the text for no end. */
  A.untilText = function (iso, none) {
    if (!iso) return h('span', { class: 'until' }, none || 'No end date');
    return ended(iso)
      ? h('span', { class: 'until warn-text' }, 'Ended ' + A.day(iso))
      : h('span', { class: 'until' }, 'Until ' + A.day(iso));
  };

  /** The end of a picked calendar day, in the admin's time zone. */
  function endOfDay(value) {
    var p = String(value).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2], 23, 59).toISOString();
  }

  function dateValue(d) {
    return (
      d.getFullYear() +
      '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) +
      '-' +
      ('0' + d.getDate()).slice(-2)
    );
  }

  /**
   * Chips for how long, plus "Pick a date" with a date field.
   * opts: name (prefix), periods ([days, label]...), none (label of a "no end" chip, or empty),
   * start ({days}, {until}, or {none}), onchange(choice).
   * The choice is {days: n}, {until: iso} or {none: true}; null while a date is not picked yet.
   */
  A.untilPicker = function (opts) {
    var choice = opts.start || null;
    var box = h('div', { class: 'until-picker' });
    var chips = h('div', {
      class: 'toggle-chips',
      role: 'group',
      'aria-label': 'How long'
    });
    var date = h('input', {
      class: 'input until-date',
      type: 'date',
      name: opts.name + '-until',
      min: dateValue(new Date(Date.now() + DAY)),
      'aria-label': 'End date',
      oninput: function () {
        choice = date.value ? { until: endOfDay(date.value) } : null;
        changed();
      }
    });
    var picking = !!(choice && choice.until);
    if (picking) date.value = dateValue(new Date(choice.until));
    function chip(name, text, on, pick) {
      return h(
        'button',
        {
          type: 'button',
          class: 'toggle-chip',
          name: opts.name + '-' + name,
          'aria-pressed': on ? 'true' : 'false',
          onclick: pick
        },
        text
      );
    }
    function changed() {
      paint();
      if (opts.onchange) opts.onchange(choice);
    }
    function paint() {
      ui.clear(chips);
      if (opts.none)
        chips.appendChild(
          chip(
            'none',
            opts.none,
            !picking && !!(choice && choice.none),
            function () {
              picking = false;
              choice = { none: true };
              changed();
            }
          )
        );
      opts.periods.forEach(function (p) {
        chips.appendChild(
          chip(
            String(p[0]),
            p[1],
            !picking && !!(choice && choice.days === p[0]),
            function () {
              picking = false;
              choice = { days: p[0] };
              changed();
            }
          )
        );
      });
      chips.appendChild(
        chip('date', 'Pick a date', picking, function () {
          picking = true;
          choice = date.value ? { until: endOfDay(date.value) } : null;
          changed();
          date.focus();
        })
      );
      date.hidden = !picking;
    }
    box.appendChild(chips);
    box.appendChild(date);
    paint();
    return {
      node: box,
      value: function () {
        return choice;
      }
    };
  };

  /** Where one key ends after `choice`: time is added to the later of now and its end. */
  A.extendedEnd = function (current, choice) {
    if (!choice) return '';
    if (choice.until) return choice.until;
    if (choice.none) return '';
    return new Date(
      Math.max(Date.now(), Date.parse(current) || 0) + choice.days * DAY
    ).toISOString();
  };

  var KEY_PERIODS = [
    [3, '3 more days'],
    [7, '1 more week'],
    [14, '2 more weeks'],
    [30, '1 more month']
  ];

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  /**
   * Gives registration keys more time. With opts.ids the dialog is about those registrations
   * only; without, the admin picks: all keys, the expired ones, those ending soon, or chosen teams.
   * opts.done(keys) runs after a change, with every key's new state.
   */
  A.extendKeys = async function (form, opts) {
    opts = opts || {};
    var keys = (await A.call('admin.keys.list', { slug: form.slug })).keys;
    var fixed = opts.ids
      ? keys.filter(function (k) {
          return opts.ids.indexOf(k.id) !== -1;
        })
      : null;
    var soon = function (k) {
      return (
        !k.expired &&
        k.keyExpires &&
        Date.parse(k.keyExpires) - Date.now() < 3 * DAY
      );
    };
    var groups = {
      all: keys,
      expired: keys.filter(function (k) {
        return k.expired;
      }),
      soon: keys.filter(soon)
    };
    var st = {
      which: groups.expired.length ? 'expired' : 'all',
      chosen: [],
      search: '',
      choice: { days: 7 }
    };

    var picked = function () {
      if (fixed) return fixed;
      if (st.which === 'chosen')
        return keys.filter(function (k) {
          return st.chosen.indexOf(k.id) !== -1;
        });
      return groups[st.which];
    };

    /* Which keys --------------------------------------------------- */
    var whichBox = h('div', {
      class: 'toggle-chips',
      role: 'group',
      'aria-label': 'Which keys'
    });
    var listBox = h('div', { class: 'key-choose' });
    function paintWhich() {
      ui.clear(whichBox);
      [
        ['all', 'All', groups.all.length],
        ['expired', 'Expired', groups.expired.length],
        ['soon', 'Ending in 3 days', groups.soon.length],
        ['chosen', 'Choose teams', null]
      ].forEach(function (w) {
        if (w[2] === 0 && w[0] !== 'all') return; // A filter with nothing in it cannot act.
        whichBox.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'toggle-chip',
              name: 'which-' + w[0],
              'aria-pressed': st.which === w[0] ? 'true' : 'false',
              onclick: function () {
                st.which = w[0];
                paintWhich();
                paintList();
                paintPreview();
              }
            },
            w[1],
            w[2] === null
              ? null
              : h('span', { class: 'chip-count' }, String(w[2]))
          )
        );
      });
    }
    var searchInput = h('input', {
      class: 'input',
      type: 'search',
      name: 'key-search',
      placeholder: 'Find a team by reference, name or title',
      'aria-label': 'Find a team',
      oninput: function (e) {
        st.search = e.target.value.trim().toLowerCase();
        paintRows();
      }
    });
    var rowsBox = h('div', {
      class: 'key-rows',
      role: 'group',
      'aria-label': 'Teams'
    });
    var shown = function () {
      return keys.filter(function (k) {
        return (
          !st.search ||
          (k.ref + ' ' + k.name + ' ' + k.title)
            .toLowerCase()
            .indexOf(st.search) !== -1
        );
      });
    };
    function paintRows() {
      ui.clear(rowsBox);
      var list = shown();
      if (!list.length)
        return rowsBox.appendChild(
          h('p', { class: 'muted-note' }, 'No team matches.')
        );
      list.forEach(function (k) {
        var on = st.chosen.indexOf(k.id) !== -1;
        rowsBox.appendChild(
          h(
            'label',
            { class: 'key-row' + (on ? ' on' : '') },
            h('input', {
              type: 'checkbox',
              name: 'key-' + k.ref,
              checked: on,
              onchange: function (e) {
                st.chosen = st.chosen.filter(function (x) {
                  return x !== k.id;
                });
                if (e.target.checked) st.chosen.push(k.id);
                paintRows();
                paintPreview();
              }
            }),
            h('span', { class: 'mono' }, k.ref),
            h(
              'span',
              { class: 'key-row-name' },
              h('bdi', null, k.name || '-'),
              k.title
                ? h('span', { class: 'muted-note' }, ' · ' + k.title)
                : null
            ),
            A.untilText(k.keyExpires, 'No end date')
          )
        );
      });
    }
    function paintList() {
      ui.clear(listBox);
      if (st.which !== 'chosen') return;
      listBox.appendChild(
        h(
          'div',
          { class: 'key-tools' },
          searchInput,
          h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              name: 'choose-shown',
              onclick: function () {
                shown().forEach(function (k) {
                  if (st.chosen.indexOf(k.id) === -1) st.chosen.push(k.id);
                });
                paintRows();
                paintPreview();
              }
            },
            'Choose all shown'
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              name: 'choose-none',
              onclick: function () {
                st.chosen = [];
                paintRows();
                paintPreview();
              }
            },
            'Clear'
          )
        )
      );
      listBox.appendChild(rowsBox);
      paintRows();
    }

    /* How long and the result --------------------------------------- */
    var picker = A.untilPicker({
      name: 'extend',
      periods: KEY_PERIODS,
      start: st.choice,
      onchange: function (c) {
        st.choice = c;
        paintPreview();
      }
    });
    var preview = h('p', { class: 'extend-preview', role: 'status' });
    var goBtn;
    function paintPreview() {
      var list = picked();
      ui.clear(preview);
      var ready = list.length && st.choice;
      if (goBtn) {
        goBtn.disabled = !ready;
        goBtn.textContent =
          list.length > 1 ? 'Extend ' + list.length + ' keys' : 'Extend key';
      }
      if (!list.length)
        return preview.appendChild(
          document.createTextNode(
            st.which === 'chosen'
              ? 'Choose at least one team.'
              : 'No keys here.'
          )
        );
      if (!st.choice)
        return preview.appendChild(
          document.createTextNode('Pick the date the keys end.')
        );
      var ends = list
        .map(function (k) {
          return A.extendedEnd(k.keyExpires, st.choice);
        })
        .sort();
      var first = A.day(ends[0]),
        last = A.day(ends[ends.length - 1]);
      var revived = list.filter(function (k) {
        return k.expired;
      }).length;
      preview.appendChild(
        h(
          'strong',
          null,
          (list.length > 1
            ? plural(list.length, 'key', 'keys') + ' will work until '
            : 'The key will work until ') +
            (first === last ? first : first + ' to ' + last) +
            '.'
        )
      );
      if (revived)
        preview.appendChild(
          document.createTextNode(
            ' ' +
              (list.length > 1
                ? plural(revived, 'expired key works', 'expired keys work')
                : 'The expired key works') +
              ' again.'
          )
        );
      if (st.choice.days)
        preview.appendChild(
          h(
            'span',
            { class: 'help' },
            "Time is added from today, or from a key's end date when that is later."
          )
        );
    }

    var summary = groups.expired.length
      ? plural(keys.length, 'key', 'keys') +
        ' given: ' +
        (keys.length - groups.expired.length) +
        ' working, ' +
        groups.expired.length +
        ' expired.'
      : plural(keys.length, 'key', 'keys') + ' given, all working.';
    var body = fixed
      ? h(
          'div',
          { class: 'l-stack extend-keys' },
          fixed.length === 1
            ? h(
                'p',
                null,
                'The key of ',
                h('span', { class: 'mono' }, fixed[0].ref),
                fixed[0].expired
                  ? h(
                      'span',
                      { class: 'warn-text' },
                      ' ended on ' + A.day(fixed[0].keyExpires)
                    )
                  : ' works until ' + A.day(fixed[0].keyExpires),
                '.'
              )
            : null,
          h('span', { class: 'label' }, 'Give it'),
          picker.node,
          preview
        )
      : h(
          'div',
          { class: 'l-stack extend-keys' },
          h('p', null, summary),
          h('span', { class: 'label' }, 'Which keys'),
          whichBox,
          listBox,
          h('span', { class: 'label' }, 'Give them'),
          picker.node,
          preview
        );
    if (!fixed) {
      paintWhich();
      paintList();
    }

    var dialog = A.modal(
      fixed ? 'Extend the edit key' : 'Extend edit keys',
      body,
      [
        { text: 'Cancel', kind: 'quiet' },
        {
          text: 'Extend',
          kind: 'primary',
          onclick: async function () {
            var list = picked();
            var req = { slug: form.slug };
            if (fixed || st.which === 'chosen' || st.which === 'soon') {
              req.which = 'chosen';
              req.ids = list.map(function (k) {
                return k.id;
              });
            } else req.which = st.which;
            if (st.choice.until) req.until = st.choice.until;
            else req.days = st.choice.days;
            var r = await A.call('admin.keys.extend', req);
            toast(
              r.changed === 1 ? 'Key extended' : r.changed + ' keys extended',
              'ok'
            );
            if (opts.done) opts.done(r.keys);
          }
        }
      ]
    );
    goBtn = dialog.el.querySelector('.dialog-actions .btn-primary');
    goBtn.name = 'extend-go';
    paintPreview();
    return dialog;
  };

  /**
   * The keys line of a form's Setup: how many keys are given and how many expired, with the
   * Extend keys button. It shows nothing while there are no keys, since there is nothing to extend.
   */
  A.keysSummary = function (form) {
    var box = h('div', { class: 'keys-summary', hidden: true });
    async function load() {
      var keys;
      try {
        keys = (await A.call('admin.keys.list', { slug: form.slug })).keys;
      } catch (e) {
        return;
      }
      ui.clear(box);
      box.hidden = !keys.length;
      if (!keys.length) return;
      var expired = keys.filter(function (k) {
        return k.expired;
      }).length;
      box.appendChild(
        h(
          'p',
          null,
          h('strong', null, plural(keys.length, 'key', 'keys') + ' given'),
          expired
            ? ': ' + (keys.length - expired) + ' working, '
            : ', all working.',
          expired
            ? h('span', { class: 'warn-text' }, expired + ' expired')
            : null,
          expired ? '.' : null
        )
      );
      box.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet',
            name: 'extend-keys',
            onclick: function (e) {
              A.busy(e.currentTarget, function () {
                return A.extendKeys(form, { done: load });
              });
            }
          },
          icon('calendar', 18),
          'Extend keys'
        )
      );
    }
    load();
    return box;
  };
})((window.App = window.App || {}));
