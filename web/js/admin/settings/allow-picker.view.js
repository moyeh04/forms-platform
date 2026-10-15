/**
 * Chips that limit a form to some values of a list. An empty choice means
 * every value, and choosing every value is stored as the empty choice.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Names the group of a section: "4C-TH2" belongs to "4C", the part
   * before the first dash.
   *
   * @param {!Object} o The option.
   * @return {string} The group, or 'Other'.
   */
  A.sectionGroup = function (o) {
    var v = String(o.value);
    return v.indexOf('-') > 0 ? v.slice(0, v.indexOf('-')) : 'Other';
  };

  /**
   * Gives the Arabic text shown under a chip, when it says more than the
   * English text and the value.
   *
   * @param {!Object} o The option.
   * @return {?string} The text, or null.
   */
  function arabicOf(o) {
    var ar = o.label?.ar;
    return ar && ar !== o.label.en && ar !== String(o.value) ? ar : null;
  }

  /**
   * Puts the options under their groups, in the order they come.
   *
   * @param {!Object} opts The picker.
   * @return {!Array<{id: string, options: !Array<!Object>}>} The groups.
   */
  function groupsOf(opts) {
    var groups = [];
    opts.options.forEach(function (o) {
      var id = opts.groupOf ? opts.groupOf(o) : '';
      var g = groups.filter(function (x) {
        return x.id === id;
      })[0];
      if (!g) {
        g = { id: id, options: [] };
        groups.push(g);
      }
      g.options.push(o);
    });
    return groups;
  }

  /**
   * Draws a chip of the picker.
   *
   * @param {!Object} p The picker: `opts` and `paint()`.
   * @param {!Object} c The chip: `name`, `text`, `on`, `click()`, `sub`.
   * @return {!Element} The chip.
   */
  function chip(p, c) {
    return h(
      'button',
      {
        type: 'button',
        class: 'toggle-chip',
        name: c.name,
        'aria-pressed': c.on ? 'true' : 'false',
        onclick: function () {
          c.click();
          p.paint();
        }
      },
      c.text,
      c.sub ? h('span', { class: 'chip-sub', lang: 'ar' }, c.sub) : null
    );
  }

  /**
   * Stores a choice; choosing every value is stored as the empty choice.
   *
   * @param {!Object} opts The picker.
   * @param {!Array<string>} values The chosen values.
   */
  function put(opts, values) {
    opts.set(values.length === opts.options.length ? [] : values);
  }

  /**
   * Draws the chip of one option.
   *
   * @param {!Object} p The picker.
   * @param {!Array<string>} chosen The values chosen now.
   * @param {!Object} o The option.
   * @return {!Element} The chip.
   */
  function optionChip(p, chosen, o) {
    var value = String(o.value);
    var on = chosen.indexOf(value) !== -1;
    return chip(p, {
      name: p.opts.name + '-' + o.value,
      text: o.label?.en || o.value,
      on: on,
      sub: arabicOf(o),
      click: function () {
        put(
          p.opts,
          on
            ? chosen.filter(function (v) {
                return v !== value;
              })
            : chosen.concat([value])
        );
      }
    });
  }

  /**
   * Draws a group: the chip that switches the whole group, when it has a
   * name, and the chips of its options.
   *
   * @param {!Object} p The picker.
   * @param {!Array<string>} chosen The values chosen now.
   * @param {!Object} g The group.
   * @return {!Element} The group.
   */
  function groupChips(p, chosen, g) {
    var values = g.options.map(function (o) {
      return String(o.value);
    });
    var whole = values.every(function (v) {
      return chosen.indexOf(v) !== -1;
    });
    var all = g.id
      ? chip(p, {
          name: p.opts.name + '-group-' + g.id,
          text: 'All ' + g.id,
          on: whole,
          click: function () {
            var rest = chosen.filter(function (v) {
              return values.indexOf(v) === -1;
            });
            put(p.opts, whole ? rest : rest.concat(values));
          }
        })
      : null;
    return h(
      'div',
      {
        class: 'toggle-chips',
        role: 'group',
        'aria-label': g.id || p.opts.all
      },
      all,
      g.options.map(function (o) {
        return optionChip(p, chosen, o);
      })
    );
  }

  /**
   * Draws the picker again.
   *
   * @param {!Object} p The picker.
   */
  function paint(p) {
    var opts = p.opts;
    var chosen = opts.get();
    ui.clear(p.box);
    p.box.appendChild(
      h(
        'div',
        { class: 'toggle-chips' },
        chip(p, {
          name: opts.name + '-all',
          text: opts.all,
          on: !chosen.length,
          click: function () {
            opts.set([]);
          }
        })
      )
    );
    p.groups.forEach(function (g) {
      p.box.appendChild(groupChips(p, chosen, g));
    });
  }

  /**
   * Draws the chips that limit a form to some values of a list.
   *
   * @param {!Object} opts `name`, the prefix of the control names; `all`,
   *     the text of the "no limit" chip; `options`; `get()` and
   *     `set(values)`; and optionally `groupOf(option)` to put the chips
   *     under a heading that switches its whole group.
   * @return {!Element} The picker.
   */
  A.allowPicker = function (opts) {
    var p = { opts: opts, box: h('div', { class: 'allow-picker' }) };
    p.groups = groupsOf(opts);
    p.paint = paint.bind(null, p);
    p.paint();
    return p.box;
  };
})(window.App);
