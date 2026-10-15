/**
 * Admin: the shared lists behind dropdown questions.
 *
 * A list has a kind, and the kind decides how it is edited, so most lists need no typing:
 *   sections  built from year groups (4C, 3L) and how many sections of each kind (TH, T …) they have
 *   numbers   a run from one number to another
 *   named     choices with an English name (majors, levels), as rows
 *   plain     short choices (groups, bylaws), as chips
 * The admin can make more lists (another set of sections) and pick, per form, which list a
 * question reads. The save bar exists only while the open list differs from its saved copy.
 */
(function (App) {
  'use strict';
  var A = App.admin,
    ui = App.ui,
    h = ui.h,
    icon = ui.icon,
    toast = ui.toast;

  /** The lists that came with the platform: their names, what they are for, and their kind. */
  var BUILTIN = {
    levels: {
      name: 'Levels',
      about: 'The level or year question.',
      kind: 'named',
      types: [
        'team_registration',
        'task_submission',
        'reservation',
        'whatsapp_registration'
      ]
    },
    curricula: {
      name: 'Bylaws',
      about: 'The bylaw (curriculum year) question.',
      kind: 'plain',
      types: ['team_registration', 'task_submission', 'reservation']
    },
    majors: {
      name: 'Majors',
      about:
        'Specializations. A form can also be limited to some of them in its setup.',
      kind: 'named',
      types: [
        'team_registration',
        'task_submission',
        'reservation',
        'whatsapp_registration'
      ]
    },
    sections: {
      name: 'Sections',
      about:
        'Lecture sections such as 4C-TH1. A form can also be limited to some of them in its setup.',
      kind: 'sections',
      types: ['team_registration', 'task_submission', 'reservation']
    },
    groups: {
      name: 'Groups',
      about: 'WhatsApp group letters (A with Chemistry, B without).',
      kind: 'plain',
      types: ['whatsapp_registration']
    },
    wa_sections: {
      name: 'WhatsApp section numbers',
      about: 'The number next to TH in a student timetable.',
      kind: 'numbers',
      types: ['whatsapp_registration']
    }
  };
  var KINDS = {
    sections: {
      label: 'Sections',
      example: '4C-TH1, 4C-T1, 3L-TH1',
      about:
        'Built from year groups and how many of each kind they have. Nothing to type.'
    },
    numbers: {
      label: 'Numbers',
      example: '1, 2, 3 … 33',
      about: 'A run from one number to another.'
    },
    named: {
      label: 'Choices with names',
      example: 'حاسبات · Computers',
      about: 'Each choice with its English name, as rows.'
    },
    plain: {
      label: 'Short choices',
      example: 'A, B, 2020',
      about: 'Short values shown as chips.'
    }
  };
  // The years offered for a new year group: 1 to 5, and any higher year a section list already uses.
  // (A level counts from 0, but a section is named by the year.) The kinds and the letters come from the lists.
  var YEARS = ['1', '2', '3', '4', '5'];
  var PEEK = 4;

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  /** The kind and the name of a list, for this page and for the Questions tab. */
  A.listKind = function (key, info) {
    return (
      ((info || {})[key] || {}).kind || (BUILTIN[key] || {}).kind || 'plain'
    );
  };
  /**
   * Whether a question may be pointed at this list instead of its own. A list the admin made may
   * always be picked; a built-in one only when it is the only built-in of its kind (Sections, the
   * WhatsApp numbers), because Levels and Majors, or Bylaws and Groups, mean different things.
   */
  A.listSwappable = function (key) {
    if (!BUILTIN.hasOwnProperty(key)) return true;
    return (
      Object.keys(BUILTIN).filter(function (k) {
        return BUILTIN[k].kind === BUILTIN[key].kind;
      }).length === 1
    );
  };
  A.listName = function (key, info) {
    return ((info || {})[key] || {}).name || (BUILTIN[key] || {}).name || key;
  };

  /** Forms whose questions (or member questions) read this list. */
  function formsUsing(forms, key) {
    return forms.filter(function (f) {
      var uses = function (fields) {
        return (fields || []).some(function (x) {
          return x.list === key || uses(x.fields);
        });
      };
      return f.status !== 'archived' && uses(f.fields);
    });
  }

  /** A saved choice as the editor holds it: a name that only repeats the value is left empty. */
  function toRows(values) {
    return (values || []).map(function (o) {
      var label = o.label || {};
      return {
        value: String(o.value),
        en: label.en && label.en !== String(o.value) ? label.en : '',
        ar: label.ar && label.ar !== String(o.value) ? label.ar : ''
      };
    });
  }
  function fromRows(rows) {
    return rows
      .filter(function (r) {
        return r.value.trim();
      })
      .map(function (r) {
        var v = r.value.trim();
        return {
          value: v,
          label: { en: r.en.trim() || v, ar: r.ar.trim() || v }
        };
      });
  }
  function plainRows(values) {
    return values.map(function (v) {
      return { value: String(v), en: '', ar: '' };
    });
  }

  /** Lines of pasted text as rows; "value | English name" gives the choice a name. */
  function parse(text) {
    return String(text)
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .map(function (l) {
        var i = l.indexOf('|');
        return i === -1
          ? { value: l, en: '', ar: '' }
          : { value: l.slice(0, i).trim(), en: l.slice(i + 1).trim(), ar: '' };
      })
      .filter(function (r) {
        return r.value;
      });
  }

  /* ── Sections: year groups × kinds × counts ─────────────────── */

  /**
   * Reads "4C-TH1 … 4C-TH8, 4C-T1 …" as [{ name: '4C', kinds: [{ code: 'TH', count: 8 }, …] }].
   * A value that the groups cannot give back exactly (a gap, another shape) is kept in `extras`.
   */
  function readSections(values) {
    var groups = [],
      extras = [],
      seen = {};
    values.forEach(function (v) {
      var m = /^([^-\s]+)-([A-Za-z]+)(\d+)$/.exec(v);
      // "4C-TH01" is kept as written: a card would write it back as "4C-TH1".
      if (!m || String(+m[3]) !== m[3]) {
        extras.push(v);
        return;
      }
      var g = groups.filter(function (x) {
        return x.name === m[1];
      })[0];
      if (!g) groups.push((g = { name: m[1], kinds: [] }));
      var k = g.kinds.filter(function (x) {
        return x.code === m[2];
      })[0];
      if (!k) g.kinds.push((k = { code: m[2], count: 0, nums: [] }));
      k.nums.push(+m[3]);
      seen[v] = true;
    });
    groups.forEach(function (g) {
      g.kinds.forEach(function (k) {
        var whole = k.nums
          .slice()
          .sort(function (a, b) {
            return a - b;
          })
          .every(function (n, i) {
            return n === i + 1;
          });
        if (whole) k.count = k.nums.length;
        else {
          k.nums.forEach(function (n) {
            extras.push(g.name + '-' + k.code + n);
          });
          k.count = 0;
        }
        delete k.nums;
      });
      g.kinds = g.kinds.filter(function (k) {
        return k.count;
      });
    });
    return {
      groups: groups.filter(function (g) {
        return g.kinds.length;
      }),
      extras: extras
    };
  }
  function writeSections(s) {
    var out = [];
    s.groups.forEach(function (g) {
      g.kinds.forEach(function (k) {
        for (var n = 1; n <= k.count; n++) out.push(g.name + '-' + k.code + n);
      });
    });
    return out.concat(
      s.extras.filter(function (v) {
        return out.indexOf(v) === -1;
      })
    );
  }

  /** "4C" is the year 4 and the letter C. */
  function groupParts(name) {
    var m = /^(\d+)([A-Za-z]+)$/.exec(name);
    return m ? { year: m[1], letter: m[2].toUpperCase() } : null;
  }

  /**
   * A number a stepper and its field share; typing is possible, never needed. The stepper keeps its own
   * buttons and field up to date, so `set` may redraw the page or not. opts.enter runs on Enter in the
   * field, after the typed number is taken.
   */
  function stepper(name, label, value, lo, hi, set, opts) {
    opts = opts || {};
    var down, up, input;
    var take = function (v) {
      v = Math.max(lo, Math.min(hi, v));
      value = v;
      input.value = String(v);
      down.disabled = v <= lo;
      up.disabled = v >= hi;
      set(v);
    };
    var typed = function () {
      var v = parseInt(input.value, 10);
      take(isNaN(v) ? value : v);
    };
    input = h('input', {
      class: 'input num stepper-input',
      type: 'number',
      inputmode: 'numeric',
      name: name,
      min: String(lo),
      max: String(hi),
      value: String(value),
      'aria-label': label,
      onchange: typed,
      // The number is typed over, not added to.
      onfocus: function (e) {
        if (e.target.select) e.target.select();
      },
      onkeydown: function (e) {
        if (e.key === 'Enter' && opts.enter) {
          e.preventDefault();
          typed();
          opts.enter();
        }
      }
    });
    down = h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: name + '-down',
        'aria-label': 'Fewer: ' + label,
        disabled: value <= lo,
        onclick: function () {
          take(value - 1);
        }
      },
      '−'
    );
    up = h(
      'button',
      {
        type: 'button',
        class: 'icon-btn sm',
        name: name + '-up',
        'aria-label': 'More: ' + label,
        disabled: value >= hi,
        onclick: function () {
          take(value + 1);
        }
      },
      '+'
    );
    return h('span', { class: 'stepper' }, down, input, up);
  }

  /** Where a new year group goes: before the first group with a higher year, or the same year and a later letter. */
  function groupSlot(groups, name) {
    var p = groupParts(name);
    for (var i = 0; p && i < groups.length; i++) {
      var q = groupParts(groups[i].name);
      if (
        q &&
        (+q.year > +p.year || (q.year === p.year && q.letter > p.letter))
      )
        return i;
    }
    return groups.length;
  }

  /** A kind or a department letter as it is typed: letters only, upper case. */
  function cleanCode(v, max) {
    return String(v || '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, max);
  }

  A.views.lists = async function (mount, picked) {
    var data = await Promise.all([
      A.call('admin.lists.get'),
      A.call('admin.forms.list')
    ]);
    var lists = data[0].lists,
      info = data[0].info || {};
    var forms = data[1].forms;
    var keys = function () {
      return Object.keys(lists);
    };
    // `open` is false while the address names no list: a phone then shows only the lists.
    var st = {
      key: keys().indexOf(picked) !== -1 ? picked : keys()[0],
      open: keys().indexOf(picked) !== -1 || picked === 'new',
      creating: picked === 'new',
      rows: [],
      order: false,
      renaming: false
    };

    var index = h('nav', {
      class: 'l-side lists-index l-stack',
      'aria-label': 'Lists'
    });
    var pane = h('section', { class: 'l-main panel list-pane' });
    var wrap = h('div', { class: 'lists l-split' }, index, pane);
    var rowsBox = h('div', { class: 'list-rows' });
    var problemBox = h('p', { class: 'error', role: 'alert', hidden: true });
    var barNote = h('span', { class: 'savebar-note', role: 'status' });
    var barWarn = h('span', { class: 'savebar-warn' });
    var saveBtn = h('button', {
      type: 'button',
      class: 'btn btn-primary',
      name: 'save-list'
    });
    var bar = h(
      'div',
      { class: 'savebar', hidden: true },
      h('span', { class: 'savebar-text' }, barNote, barWarn),
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-quiet',
          name: 'discard',
          onclick: function () {
            load(st.key);
            paint();
          }
        },
        'Discard'
      ),
      saveBtn
    );

    var kind = function (k) {
      return A.listKind(k || st.key, info);
    };
    var name = function (k) {
      return A.listName(k || st.key, info);
    };
    function load(key) {
      st.key = key;
      st.rows = toRows(lists[key]);
      st.order = false;
      st.renaming = false;
      st.draft = null;
      st.sections =
        kind() === 'sections'
          ? readSections(
              st.rows.map(function (r) {
                return r.value;
              })
            )
          : null;
    }
    function dirty() {
      return (
        !st.creating &&
        (JSON.stringify(fromRows(st.rows)) !==
          JSON.stringify(fromRows(toRows(lists[st.key]))) ||
          st.rows.some(function (r) {
            return !r.value.trim() && (r.en.trim() || r.ar.trim());
          }))
      );
    }
    function named() {
      return st.rows.some(function (r) {
        return r.en || r.ar;
      });
    }
    /** Rows are needed for names and order; plain values read best as chips. */
    function asRows() {
      return kind() === 'named' || st.order || named();
    }

    /** The first thing that stops a save, or ''. `at` is the row to mark. */
    function problem() {
      var seen = {},
        out = { text: '', at: -1 };
      st.rows.some(function (r, i) {
        var v = r.value.trim();
        if (!v && (r.en.trim() || r.ar.trim()))
          out = {
            text:
              'Choice ' +
              (i + 1) +
              ' has a name but no value. Write the choice or remove the row.',
            at: i
          };
        else if (v && seen[v])
          out = {
            text: '"' + v + '" is in the list twice. Remove one of them.',
            at: i
          };
        seen[v] = true;
        return out.text;
      });
      if (!out.text && !fromRows(st.rows).length)
        out.text = 'A list needs at least one choice.';
      return out;
    }

    /** What a save would change, in words. */
    function changes() {
      var before = (lists[st.key] || []).map(function (o) {
        return String(o.value);
      });
      var now = fromRows(st.rows).map(function (o) {
        return o.value;
      });
      var added = now.filter(function (v) {
        return before.indexOf(v) === -1;
      });
      var removed = before.filter(function (v) {
        return now.indexOf(v) === -1;
      });
      var parts = [];
      if (added.length) parts.push(added.length + ' added');
      if (removed.length) parts.push(removed.length + ' removed');
      if (!parts.length) parts.push('names or order changed');
      // A form limited to some values of this list (rules.majors, rules.sections) loses a removed one.
      var rule =
        st.key === 'majors'
          ? 'majors'
          : kind() === 'sections'
            ? 'sections'
            : '';
      var limited = !rule
        ? []
        : formsUsing(forms, st.key).filter(function (f) {
            return ((f.rules || {})[rule] || []).some(function (v) {
              return removed.indexOf(String(v)) !== -1;
            });
          });
      return { text: parts.join(', '), limited: limited };
    }

    /** Paints everything that depends on the rows without touching the inputs being typed in. */
    function changed() {
      var isDirty = dirty(),
        bad = problem();
      A.unsaved = isDirty;
      bar.hidden = !isDirty;
      problemBox.hidden = !(isDirty && bad.text);
      problemBox.textContent = bad.text;
      Array.prototype.forEach.call(
        rowsBox.querySelectorAll('[data-i]'),
        function (el) {
          el.classList.toggle('bad', isDirty && +el.dataset.i === bad.at);
        }
      );
      if (isDirty) {
        var c = changes();
        barNote.textContent = name() + ': ' + c.text + '. Not saved yet.';
        barWarn.textContent = c.limited.length
          ? 'Limited to a removed choice: ' +
            c.limited
              .map(function (f) {
                return f.title;
              })
              .join(', ') +
            '.'
          : '';
        saveBtn.textContent = 'Save ' + name();
      }
      paintIndex();
    }

    async function leaveOk() {
      if (!dirty()) return true;
      return ui.confirm({
        title: 'Leave without saving?',
        body: 'Your changes to ' + name() + ' are not saved.',
        confirmText: 'Leave',
        danger: true
      });
    }
    async function select(key) {
      if ((key !== st.key || st.creating) && !(await leaveOk())) return;
      if (key !== st.key || st.creating) load(key);
      st.creating = false;
      st.open = true;
      A.setHash('#/lists/' + encodeURIComponent(key));
      paint();
    }
    async function startNew() {
      if (!(await leaveOk())) return;
      load(st.key);
      st.creating = true;
      st.open = true;
      A.setHash('#/lists/new');
      paint();
      var el = pane.querySelector('[name="list-name"]');
      if (el && el.focus) el.focus();
    }

    saveBtn.addEventListener('click', function () {
      A.busy(saveBtn, async function () {
        if (problem().text) {
          changed();
          if (problemBox.scrollIntoView)
            problemBox.scrollIntoView({ block: 'center' });
          return;
        }
        var out = await A.call('admin.lists.set', {
          key: st.key,
          values: fromRows(st.rows)
        });
        lists = out.lists;
        info = out.info || info;
        load(st.key);
        toast(
          name() + ' saved. Every form that uses it shows the new choices.',
          'ok'
        );
        paint();
      });
    });

    function paintIndex() {
      ui.clear(index);
      index.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet list-new',
            name: 'new-list',
            'aria-current': st.creating ? 'true' : null,
            onclick: startNew
          },
          icon('plus', 18),
          'New list'
        )
      );
      keys().forEach(function (k) {
        var current = k === st.key && !st.creating;
        var values = current ? fromRows(st.rows) : lists[k] || [];
        var users = formsUsing(forms, k).length;
        var peek =
          values
            .slice(0, PEEK)
            .map(function (o) {
              return (o.label && o.label.en) || o.value;
            })
            .join(', ') + (values.length > PEEK ? ' …' : '');
        index.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'list-card',
              name: 'pick-' + k,
              'aria-current': current ? 'true' : null,
              onclick: function () {
                select(k);
              }
            },
            h(
              'span',
              { class: 'list-card-name' },
              name(k),
              current && dirty()
                ? h('span', { class: 'badge draft' }, 'Not saved')
                : name(k) !== KINDS[kind(k)].label
                  ? h('span', { class: 'list-card-kind' }, KINDS[kind(k)].label)
                  : null
            ),
            h(
              'span',
              { class: 'list-card-peek', dir: 'auto' },
              peek || 'No choices yet'
            ),
            h(
              'span',
              { class: 'list-card-meta' },
              plural(values.length, 'choice', 'choices') +
                ' · ' +
                (users ? plural(users, 'form', 'forms') : 'no form yet')
            )
          )
        );
      });
    }

    /** `keep`: the editor already shows the change (a stepper), so only the list of every section is drawn again. */
    function setRows(rows, keep) {
      st.rows = rows;
      if (keep) paintPreview();
      else paintRows();
      changed();
    }
    function removeRow(i) {
      st.rows.splice(i, 1);
      if (st.sections)
        st.sections = readSections(
          st.rows.map(function (r) {
            return r.value;
          })
        );
      paintRows();
      changed();
    }

    /* Editors -------------------------------------------------------- */

    /**
     * The kinds, letters and years the section lists use, in the order they first appear (the groups
     * being edited first, then the saved lists). Nothing typed is kept apart from a group that uses it, so a
     * typo leaves no chip behind.
     */
    function sectionParts(s) {
      var out = { kinds: [], letters: [], years: YEARS.slice() };
      var know = function (arr, v) {
        if (v && arr.indexOf(v) === -1) arr.push(v);
      };
      var take = function (groups) {
        groups.forEach(function (g) {
          var p = groupParts(g.name);
          if (p) {
            know(out.letters, p.letter);
            know(out.years, String(+p.year));
          }
          g.kinds.forEach(function (k) {
            know(out.kinds, k.code);
          });
        });
      };
      take(s.groups);
      keys().forEach(function (k) {
        // The saved copy of this list counts too, so a kind removed in this edit can be added back.
        if (kind(k) === 'sections')
          take(
            readSections(
              (lists[k] || []).map(function (o) {
                return String(o.value);
              })
            ).groups
          );
      });
      out.years.sort(function (x, y) {
        return x - y;
      });
      return out;
    }

    /** A kind typed for a card or the draft: refused when it is empty or already known, in any case. */
    function newKindProblem(code, known) {
      if (!code) return 'Type the letters of the kind, such as TH.';
      return known.some(function (k) {
        return k.toUpperCase() === code;
      })
        ? code + ' is already a kind.'
        : '';
    }

    /** "+ New kind": a chip that turns into a field; Enter or Add takes the kind, Escape gives up. */
    function newKindChip(name, known, take) {
      var box = h('span', { class: 'sec-new' });
      var paint = function (typing) {
        ui.clear(box);
        if (!typing)
          return box.appendChild(
            h(
              'button',
              {
                type: 'button',
                class: 'toggle-chip sm add',
                name: name + '-add',
                onclick: function () {
                  paint(true);
                  var el = box.querySelector('input');
                  if (el && el.focus) el.focus();
                }
              },
              '+ New kind'
            )
          );
        var err = h('span', {
          class: 'error',
          id: name + '-err',
          role: 'alert'
        });
        var input = h('input', {
          class: 'input sec-letter',
          name: name + '-new',
          maxlength: '3',
          placeholder: 'L',
          'aria-label': 'New kind',
          'aria-describedby': name + '-err',
          autocomplete: 'off',
          oninput: function (e) {
            e.target.value = cleanCode(e.target.value, 3);
            err.textContent = '';
          },
          onkeydown: function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              go();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              paint(false);
            }
          }
        });
        var go = function () {
          var code = cleanCode(input.value, 3),
            why = newKindProblem(code, known);
          if (why) {
            err.textContent = why;
            return input.focus && input.focus();
          }
          take(code);
        };
        box.appendChild(input);
        box.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-quiet sm',
              name: name + '-take',
              onclick: go
            },
            'Add'
          )
        );
        box.appendChild(err);
      };
      paint(false);
      return box;
    }

    function sectionsEditor() {
      var s = st.sections;
      var parts = sectionParts(s);
      var apply = function () {
        setRows(plainRows(writeSections(s)));
      };
      var box = h('div', { class: 'sec-editor l-stack' });
      var count = s.groups.length;
      box.appendChild(
        h(
          'div',
          { class: 'sec-top' },
          h(
            'span',
            { class: 'muted-note' },
            count
              ? plural(count, 'year group', 'year groups')
              : 'No year groups yet.'
          ),
          st.draft
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  class: 'btn sm ' + (count ? 'btn-quiet' : 'btn-primary'),
                  name: 'add-group-open',
                  onclick: function () {
                    st.draft = {
                      year: '',
                      letter: '',
                      typing: false,
                      counts: {},
                      kinds: []
                    };
                    paintRows();
                    var first = rowsBox.querySelector('[name^="group-year-"]');
                    if (first && first.focus) first.focus();
                  }
                },
                icon('plus', 16),
                'Add a year group'
              )
        )
      );
      if (st.draft) box.appendChild(groupDraft(s, parts));
      s.groups.forEach(function (g, gi) {
        var used = g.kinds.map(function (k) {
          return k.code;
        });
        var more = parts.kinds.filter(function (c) {
          return used.indexOf(c) === -1;
        });
        var total = function () {
          return g.kinds.reduce(function (n, k) {
            return n + k.count;
          }, 0);
        };
        var sum = h(
          'span',
          { class: 'muted-note' },
          plural(total(), 'section', 'sections')
        );
        var addKind = function (code) {
          g.kinds.push({ code: code, count: 1 });
          apply();
        };
        box.appendChild(
          h(
            'div',
            { class: 'sec-group', dataset: { group: g.name } },
            h(
              'div',
              { class: 'sec-group-head' },
              h('strong', { class: 'sec-group-name', tabindex: '-1' }, g.name),
              sum,
              h(
                'button',
                {
                  type: 'button',
                  class: 'icon-btn sm danger',
                  name: 'remove-group-' + g.name,
                  'aria-label': 'Remove the group ' + g.name,
                  onclick: function () {
                    s.groups.splice(gi, 1);
                    apply();
                  }
                },
                icon('trash', 16)
              )
            ),
            h(
              'div',
              { class: 'sec-kinds' },
              g.kinds.map(function (k, ki) {
                var range = h('span', { class: 'sec-range muted-note' });
                var paintRange = function () {
                  range.textContent =
                    g.name +
                    '-' +
                    k.code +
                    '1' +
                    (k.count > 1 ? ' to ' + k.code + k.count : '');
                };
                paintRange();
                return h(
                  'div',
                  {
                    class: 'sec-kind' + (g.kinds.length > 1 ? ' removable' : '')
                  },
                  h('span', { class: 'sec-code' }, k.code),
                  // At least one: a kind leaves the group with its own button, never by counting down.
                  stepper(
                    'count-' + g.name + '-' + k.code,
                    k.code + ' sections of ' + g.name,
                    k.count,
                    1,
                    99,
                    function (v) {
                      k.count = v;
                      paintRange();
                      sum.textContent = plural(total(), 'section', 'sections');
                      setRows(plainRows(writeSections(s)), true);
                    }
                  ),
                  range,
                  // The last kind goes with the group, so a group never empties by itself.
                  g.kinds.length > 1
                    ? h(
                        'button',
                        {
                          type: 'button',
                          class: 'icon-btn sm danger',
                          name: 'remove-kind-' + g.name + '-' + k.code,
                          'aria-label': 'Remove ' + k.code + ' from ' + g.name,
                          onclick: function () {
                            g.kinds.splice(ki, 1);
                            apply();
                          }
                        },
                        icon('trash', 16)
                      )
                    : null
                );
              })
            ),
            h(
              'div',
              { class: 'sec-more' },
              h('span', { class: 'muted-note' }, 'Add a kind:'),
              more.map(function (c) {
                return h(
                  'button',
                  {
                    type: 'button',
                    class: 'toggle-chip sm',
                    name: 'add-kind-' + g.name + '-' + c,
                    onclick: function () {
                      addKind(c);
                    }
                  },
                  '+ ' + c
                );
              }),
              newKindChip('kind-' + g.name, parts.kinds, addKind)
            )
          )
        );
      });
      if (s.extras.length) {
        box.appendChild(
          h(
            'div',
            { class: 'sec-extras' },
            h('span', { class: 'label' }, 'Other sections'),
            h(
              'p',
              { class: 'help' },
              'These do not follow the year-kind-number pattern, so they are kept as they are.'
            ),
            h(
              'ul',
              { class: 'value-chips' },
              s.extras.map(function (v) {
                return h(
                  'li',
                  { class: 'value-chip' },
                  h('span', { dir: 'auto' }, v),
                  h(
                    'button',
                    {
                      type: 'button',
                      name: 'remove-extra-' + v,
                      'aria-label': 'Remove ' + v,
                      onclick: function () {
                        s.extras = s.extras.filter(function (x) {
                          return x !== v;
                        });
                        apply();
                      }
                    },
                    icon('x', 14)
                  )
                );
              })
            )
          )
        );
      }
      return box;
    }

    /**
     * A new year group, drawn as a card where it is added: a year, a department letter, and how many
     * sections of each kind. Every kind starts at 0, meaning "not in this group"; nothing is taken from
     * another group. Add appears, named after the group, once the group can be added; until then the
     * line under the counts says what is missing.
     */
    function groupDraft(s, parts) {
      var d = st.draft;
      var kinds = parts.kinds.concat(
        d.kinds.filter(function (k) {
          return parts.kinds.indexOf(k) === -1;
        })
      );
      var letters = parts.letters.concat(
        d.typing || !d.letter || parts.letters.indexOf(d.letter) !== -1
          ? []
          : [d.letter]
      );
      var card = h('div', {
        class: 'sec-group sec-draft',
        name: 'group-draft',
        role: 'group',
        'aria-label': 'New year group'
      });
      var foot = h('div', { class: 'sec-foot' });
      var groupName = function () {
        return d.year && d.letter ? d.year + d.letter : '';
      };
      var total = function () {
        return kinds.reduce(function (n, k) {
          return n + (d.counts[k] || 0);
        }, 0);
      };
      var exists = function () {
        return s.groups.some(function (g) {
          return g.name === groupName();
        });
      };
      var ready = function () {
        return groupName() && !exists() && total() > 0;
      };
      var redraw = function (focusName) {
        paintRows();
        var el =
          focusName && rowsBox.querySelector('[name="' + focusName + '"]');
        if (el && el.focus) el.focus();
      };
      var add = function () {
        if (!ready()) return;
        var name = groupName();
        s.groups.splice(groupSlot(s.groups, name), 0, {
          name: name,
          kinds: kinds
            .filter(function (k) {
              return d.counts[k] > 0;
            })
            .map(function (k) {
              return { code: k, count: d.counts[k] };
            })
        });
        st.draft = null;
        setRows(plainRows(writeSections(s)));
        var head = rowsBox.querySelector(
          '[data-group="' + name + '"] .sec-group-name'
        );
        if (head) {
          if (head.scrollIntoView) head.scrollIntoView({ block: 'center' });
          if (head.focus) head.focus();
        }
      };
      var paintFoot = function () {
        ui.clear(foot);
        var name = groupName();
        var why =
          !d.year && !d.letter
            ? 'Pick a year and a department letter.'
            : !d.year
              ? 'Pick a year.'
              : !d.letter
                ? 'Pick a department letter.'
                : exists()
                  ? name + ' is already in this list.'
                  : !total()
                    ? 'Set at least one kind above 0.'
                    : '';
        if (!kinds.length && !why) why = 'Add a kind, such as TH.';
        foot.appendChild(
          h(
            'p',
            { class: 'muted-note', name: 'group-missing', role: 'status' },
            why
          )
        );
        foot.appendChild(
          h(
            'div',
            { class: 'actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-quiet sm',
                name: 'add-group-cancel',
                onclick: function () {
                  st.draft = null;
                  redraw('add-group-open');
                }
              },
              'Cancel'
            ),
            ready()
              ? h(
                  'button',
                  {
                    type: 'button',
                    class: 'btn btn-primary sm',
                    name: 'add-group',
                    onclick: add
                  },
                  icon('plus', 16),
                  'Add ' + name
                )
              : null
          )
        );
      };
      var chip = function (key, v) {
        return h(
          'button',
          {
            type: 'button',
            class: 'toggle-chip sm',
            name: 'group-' + key + '-' + v,
            'aria-pressed': d[key] === v ? 'true' : 'false',
            onclick: function () {
              if (key === 'letter') d.typing = false;
              d[key] = d[key] === v ? '' : v;
              redraw('group-' + key + '-' + v);
            }
          },
          v
        );
      };
      var letterBox = d.typing
        ? h(
            'label',
            { class: 'sec-new' },
            h('span', { class: 'tool-label' }, 'New letter'),
            h('input', {
              class: 'input sec-letter',
              name: 'group-letter-new',
              maxlength: '2',
              placeholder: 'M',
              'aria-label': 'New department letter',
              autocomplete: 'off',
              value: d.letter,
              oninput: function (e) {
                e.target.value = d.letter = cleanCode(e.target.value, 2);
                paintFoot();
              },
              onkeydown: function (e) {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  var first = card.querySelector('.stepper-input');
                  if (first && first.focus) first.focus();
                }
              }
            })
          )
        : h(
            'button',
            {
              type: 'button',
              class: 'toggle-chip sm add',
              name: 'group-letter-add',
              onclick: function () {
                d.letter = '';
                d.typing = true;
                redraw('group-letter-new');
              }
            },
            '+ New letter'
          );
      card.appendChild(h('h3', null, 'New year group'));
      card.appendChild(
        h(
          'div',
          { class: 'sec-pick' },
          h('span', { class: 'label' }, 'Year'),
          h(
            'div',
            { class: 'toggle-chips' },
            parts.years.map(function (v) {
              return chip('year', v);
            })
          )
        )
      );
      card.appendChild(
        h(
          'div',
          { class: 'sec-pick' },
          h('span', { class: 'label' }, 'Department letter'),
          h(
            'div',
            { class: 'toggle-chips' },
            letters.map(function (v) {
              return chip('letter', v);
            }),
            letterBox
          )
        )
      );
      card.appendChild(
        h(
          'div',
          { class: 'sec-kinds' },
          kinds.map(function (k) {
            var range = h('span', { class: 'sec-range muted-note' });
            var paintRange = function () {
              var n = d.counts[k] || 0,
                name = groupName() || 'The group';
              range.textContent = n
                ? name + '-' + k + '1' + (n > 1 ? ' to ' + k + n : '')
                : 'None';
            };
            paintRange();
            return h(
              'div',
              { class: 'sec-kind' },
              h('span', { class: 'sec-code' }, k),
              stepper(
                'draft-count-' + k,
                k + ' sections of the new group',
                d.counts[k] || 0,
                0,
                99,
                function (v) {
                  d.counts[k] = v;
                  paintRange();
                  paintFoot();
                },
                { enter: add }
              ),
              range
            );
          })
        )
      );
      card.appendChild(
        h(
          'div',
          { class: 'sec-more' },
          newKindChip('draft-kind', kinds, function (code) {
            d.kinds.push(code);
            d.counts[code] = 1;
            redraw('draft-count-' + code);
          })
        )
      );
      card.appendChild(foot);
      paintFoot();
      return card;
    }

    function numbersEditor() {
      var nums = st.rows.map(function (r) {
        return parseInt(r.value, 10);
      });
      var run =
        nums.length &&
        nums.every(function (n, i) {
          return (
            !isNaN(n) &&
            String(n) === st.rows[i].value &&
            (i === 0 || n === nums[i - 1] + 1)
          );
        });
      if (st.rows.length && !run) return null;
      var from = nums.length ? nums[0] : 1,
        to = nums.length ? nums[nums.length - 1] : 1;
      var set = function (a, b) {
        if (b < a) b = a;
        var out = [];
        for (var n = a; n <= b && out.length <= 300; n++) out.push(String(n));
        setRows(plainRows(out));
      };
      return h(
        'div',
        { class: 'num-editor' },
        h(
          'div',
          { class: 'num-run' },
          h(
            'div',
            { class: 'field-row' },
            h('span', { class: 'label' }, 'From'),
            stepper('range-from', 'First number', from, 0, 999, function (v) {
              set(v, Math.max(v, to));
            })
          ),
          h(
            'div',
            { class: 'field-row' },
            h('span', { class: 'label' }, 'To'),
            stepper(
              'range-to',
              'Last number',
              to,
              from,
              from + 300,
              function (v) {
                set(from, v);
              }
            )
          )
        ),
        h(
          'p',
          { class: 'muted-note' },
          plural(st.rows.length, 'choice', 'choices') +
            ': ' +
            (st.rows.length ? from + ' to ' + to : 'none')
        )
      );
    }

    function rowEl(r, i) {
      var move = function (d) {
        var j = i + d;
        var t = st.rows[i];
        st.rows[i] = st.rows[j];
        st.rows[j] = t;
        paintRows();
        changed();
      };
      var edit = function (key) {
        return function (v) {
          r[key] = v;
          changed();
        };
      };
      return h(
        'li',
        { class: 'choice', dataset: { i: String(i) } },
        h('span', { class: 'choice-n' }, String(i + 1)),
        A.text(r.value, edit('value'), {
          class: 'input',
          name: 'value-' + i,
          'aria-label': 'Choice ' + (i + 1),
          dir: 'auto'
        }),
        A.text(r.en, edit('en'), {
          class: 'input choice-en',
          name: 'en-' + i,
          'aria-label': 'English name of choice ' + (i + 1),
          placeholder: 'English name',
          dir: 'ltr'
        }),
        // An Arabic name that differs from the value is rare; its column exists only for a list that has one.
        st.withAr
          ? A.text(r.ar, edit('ar'), {
              class: 'input choice-ar',
              name: 'ar-' + i,
              'aria-label': 'Arabic name of choice ' + (i + 1),
              placeholder: 'الاسم بالعربية',
              dir: 'rtl',
              lang: 'ar'
            })
          : null,
        h(
          'span',
          { class: 'choice-tools' },
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn sm',
              'aria-label': 'Move up',
              disabled: i === 0,
              onclick: function () {
                move(-1);
              }
            },
            '↑'
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn sm',
              'aria-label': 'Move down',
              disabled: i === st.rows.length - 1,
              onclick: function () {
                move(1);
              }
            },
            '↓'
          ),
          h(
            'button',
            {
              type: 'button',
              class: 'icon-btn sm danger',
              name: 'remove-' + i,
              'aria-label': 'Remove ' + (r.value || 'this choice'),
              onclick: function () {
                removeRow(i);
              }
            },
            icon('trash', 16)
          )
        )
      );
    }
    function chipEl(r, i) {
      return h(
        'li',
        { class: 'value-chip', dataset: { i: String(i) } },
        h('span', { dir: 'auto' }, r.value),
        h(
          'button',
          {
            type: 'button',
            name: 'remove-' + i,
            'aria-label': 'Remove ' + r.value,
            onclick: function () {
              removeRow(i);
            }
          },
          icon('x', 14)
        )
      );
    }
    function choicesEditor() {
      var box = h('div');
      st.withAr = st.rows.some(function (r) {
        return r.ar;
      });
      var rows = asRows();
      if (!st.rows.length)
        box.appendChild(
          h(
            'div',
            { class: 'empty' },
            h('strong', null, 'No choices yet.'),
            ' Add the first one below.'
          )
        );
      else if (!rows)
        box.appendChild(h('ul', { class: 'value-chips' }, st.rows.map(chipEl)));
      else {
        box.appendChild(
          h(
            'div',
            {
              class: 'choice-head' + (st.withAr ? ' with-ar' : ''),
              'aria-hidden': 'true'
            },
            h('span'),
            h('span', null, 'Choice'),
            h('span', null, 'English name'),
            st.withAr ? h('span', null, 'Arabic name') : null,
            h('span')
          )
        );
        box.appendChild(
          h(
            'ol',
            { class: 'choices' + (st.withAr ? ' with-ar' : '') },
            st.rows.map(rowEl)
          )
        );
      }
      box.appendChild(adder(rows));
      // Chips cannot rename or reorder, so a plain list offers the rows; rows of a plain list offer the way back.
      if (st.rows.length && kind() !== 'named' && !named())
        box.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              name: rows ? 'short-view' : 'edit-rows',
              onclick: function () {
                st.order = !rows;
                paintRows();
                changed();
              }
            },
            rows
              ? 'Back to the short view'
              : 'Rename, reorder or add English names'
          )
        );
      box.appendChild(many());
      return box;
    }

    function adder(rows) {
      var v = h('input', {
        class: 'input',
        name: 'new-value',
        placeholder: 'New choice',
        dir: 'auto',
        'aria-label': 'New choice'
      });
      var en = rows
        ? h('input', {
            class: 'input',
            name: 'new-en',
            placeholder: 'English name (optional)',
            dir: 'ltr',
            'aria-label': 'English name of the new choice'
          })
        : null;
      var add = function () {
        if (!v.value.trim()) return v.focus();
        st.rows.push({
          value: v.value.trim(),
          en: en ? en.value.trim() : '',
          ar: ''
        });
        paintRows();
        changed();
        var next = rowsBox.querySelector('[name="new-value"]');
        if (next && next.focus) next.focus();
      };
      [v, en].forEach(function (x) {
        if (x)
          x.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          });
      });
      return h(
        'div',
        { class: 'choice-add' + (rows ? '' : ' short') },
        v,
        en,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet sm',
            name: 'add-choice',
            onclick: add
          },
          icon('plus', 18),
          'Add'
        )
      );
    }

    /** Many choices in one step: pasted lines. */
    function many() {
      var paste = h('textarea', {
        class: 'textarea',
        rows: '5',
        name: 'paste-list',
        placeholder:
          'One choice on each line. For an English name, add a bar:\nحاسبات | Computers',
        'aria-label': 'Choices, one on each line'
      });
      var acts = h('div', { class: 'actions' });
      var use = function (replace) {
        return function () {
          st.rows = (replace ? [] : st.rows).concat(parse(paste.value));
          paste.value = '';
          paintRows();
          changed();
        };
      };
      paste.addEventListener('input', function () {
        ui.clear(acts);
        var n = parse(paste.value).length;
        if (!n) return;
        acts.appendChild(
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-quiet sm',
              name: 'paste-add',
              onclick: use(false)
            },
            'Add ' + plural(n, 'choice', 'choices') + ' to the end'
          )
        );
        if (st.rows.length)
          acts.appendChild(
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn-quiet sm',
                name: 'paste-replace',
                onclick: use(true)
              },
              'Replace the list with ' + (n === 1 ? 'it' : 'them')
            )
          );
      });
      return h(
        'details',
        { class: 'list-many', name: 'add-many' },
        h('summary', null, 'Paste many at once'),
        paste,
        acts
      );
    }

    function paintRows() {
      ui.clear(rowsBox);
      var k = kind();
      var ed =
        k === 'sections'
          ? sectionsEditor()
          : k === 'numbers'
            ? numbersEditor()
            : null;
      st.preview = null;
      rowsBox.appendChild(ed || choicesEditor());
      if (k === 'sections') {
        st.preview = h('div');
        rowsBox.appendChild(st.preview);
        paintPreview();
      }
    }

    /** Every section of the list, folded: the values a save would store. */
    function paintPreview() {
      if (!st.preview) return;
      var open = st.preview.firstChild && st.preview.firstChild.open;
      ui.clear(st.preview);
      if (st.rows.length)
        st.preview.appendChild(
          h(
            'details',
            { class: 'list-many sec-preview', open: open || null },
            h(
              'summary',
              null,
              'See all ' + plural(st.rows.length, 'section', 'sections')
            ),
            h(
              'ul',
              { class: 'value-chips' },
              st.rows.map(function (r) {
                return h('li', { class: 'value-chip plain' }, r.value);
              })
            )
          )
        );
    }

    /* Pane ----------------------------------------------------------- */

    function createPane() {
      var form = (st.newList = st.newList || {
        name: '',
        kind: 'sections',
        copyOf: ''
      });
      var err = h('p', { class: 'error', role: 'alert', hidden: true });
      var actions = h('div', { class: 'actions' });
      var paintActions = function () {
        ui.clear(actions);
        if (!form.name.trim()) return;
        var btn = h(
          'button',
          { type: 'button', class: 'btn btn-primary', name: 'create-list' },
          'Make "' + form.name.trim() + '"'
        );
        btn.addEventListener('click', function () {
          A.busy(btn, async function () {
            try {
              var out = await A.call('admin.lists.create', {
                name: form.name,
                kind: form.kind,
                copyOf: form.copyOf || undefined
              });
              lists = out.lists;
              info = out.info;
              st.newList = null;
              st.creating = false;
              load(out.key);
              A.setHash('#/lists/' + encodeURIComponent(out.key));
              toast(
                '"' +
                  name(out.key) +
                  '" is ready. Pick it for a question in the Questions tab of a form.',
                'ok'
              );
              paint();
            } catch (e) {
              if (e.code !== 'list_name_taken' && e.code !== 'list_name')
                throw e;
              err.textContent = e.message;
              err.hidden = false;
            }
          });
        });
        actions.appendChild(btn);
      };
      var nameInput = A.text(
        form.name,
        function (v) {
          form.name = v;
          err.hidden = true;
          paintActions();
        },
        {
          name: 'list-name',
          placeholder: 'For example: Sections of the third year',
          maxlength: '60'
        }
      );
      var kindBox = h('div', {
        class: 'kind-cards l-grid',
        role: 'radiogroup',
        'aria-label': 'Kind of list'
      });
      var fromBox = h('div');
      var paintKinds = function () {
        ui.clear(kindBox);
        Object.keys(KINDS).forEach(function (k) {
          var on = form.kind === k;
          kindBox.appendChild(
            h(
              'button',
              {
                type: 'button',
                class: 'kind-card',
                role: 'radio',
                name: 'kind-' + k,
                'aria-checked': on ? 'true' : 'false',
                onclick: function () {
                  form.kind = k;
                  form.copyOf = '';
                  paintKinds();
                }
              },
              h('strong', null, KINDS[k].label),
              h(
                'span',
                { class: 'kind-example', dir: 'ltr' },
                KINDS[k].example
              ),
              h('span', { class: 'muted-note' }, KINDS[k].about)
            )
          );
        });
        ui.clear(fromBox);
        var same = keys().filter(function (k) {
          return kind(k) === form.kind;
        });
        fromBox.appendChild(h('span', { class: 'label' }, 'Start with'));
        fromBox.appendChild(
          h(
            'div',
            { class: 'toggle-chips' },
            [['', 'Nothing']]
              .concat(
                same.map(function (k) {
                  return [k, 'A copy of ' + name(k)];
                })
              )
              .map(function (o) {
                return h(
                  'button',
                  {
                    type: 'button',
                    class: 'toggle-chip sm',
                    name: 'copy-' + (o[0] || 'none'),
                    'aria-pressed': form.copyOf === o[0] ? 'true' : 'false',
                    onclick: function () {
                      form.copyOf = o[0];
                      paintKinds();
                    }
                  },
                  o[1]
                );
              })
          )
        );
      };
      paintKinds();
      paintActions();
      return [
        h('h2', null, 'New list'),
        h(
          'p',
          { class: 'help' },
          'A list can be asked by any number of forms. After you make it, pick it for a question in the Questions tab of a form.'
        ),
        A.field('Name', nameInput),
        err,
        h('span', { class: 'label' }, 'Kind'),
        kindBox,
        fromBox,
        actions
      ];
    }

    function headPane() {
      var custom = !!info[st.key];
      var users = formsUsing(forms, st.key);
      var about = (BUILTIN[st.key] || {}).about || KINDS[kind()].about;
      var title;
      if (st.renaming) {
        var input = A.text(name(), function () {}, {
          name: 'rename-input',
          'aria-label': 'Name of the list',
          maxlength: '60'
        });
        var renameBtn = h(
          'button',
          { type: 'button', class: 'btn btn-quiet sm', name: 'rename-save' },
          'Rename'
        );
        renameBtn.addEventListener('click', function () {
          A.busy(renameBtn, async function () {
            var out = await A.call('admin.lists.rename', {
              key: st.key,
              name: input.value
            });
            info = out.info;
            st.renaming = false;
            paint();
          });
        });
        title = h(
          'div',
          { class: 'list-rename' },
          input,
          renameBtn,
          h(
            'button',
            {
              type: 'button',
              class: 'link-btn',
              onclick: function () {
                st.renaming = false;
                paint();
              }
            },
            'Cancel'
          )
        );
      } else {
        title = h(
          'div',
          { class: 'list-title' },
          h('h2', null, name()),
          name() !== KINDS[kind()].label
            ? h('span', { class: 'list-card-kind' }, KINDS[kind()].label)
            : null,
          custom
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'link-btn',
                  name: 'rename-list',
                  onclick: function () {
                    st.renaming = true;
                    paint();
                  }
                },
                'Rename'
              )
            : null,
          // Deleting is offered only while no form asks the list.
          custom && !users.length
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'link-btn danger-link',
                  name: 'delete-list',
                  onclick: function (e) {
                    var btn = e.currentTarget;
                    ui.confirm({
                      title: 'Delete ' + name() + '?',
                      body: 'No form asks this list. It is removed for good.',
                      confirmText: 'Delete',
                      danger: true
                    }).then(function (yes) {
                      if (!yes) return;
                      A.busy(btn, async function () {
                        var out = await A.call('admin.lists.delete', {
                          key: st.key
                        });
                        lists = out.lists;
                        info = out.info;
                        A.unsaved = false;
                        load(keys()[0]);
                        st.open = false;
                        A.setHash('#/lists');
                        paint();
                      });
                    });
                  }
                },
                'Delete'
              )
            : null
        );
      }
      return h(
        'div',
        { class: 'list-head' },
        title,
        h('p', { class: 'help' }, about),
        h(
          'p',
          { class: 'used-by' },
          users.length
            ? users.reduce(
                function (out, f, i) {
                  return out.concat(
                    i ? ', ' : [],
                    h(
                      'a',
                      {
                        href: '#/f/' + encodeURIComponent(f.slug) + '/questions'
                      },
                      f.title
                    )
                  );
                },
                ['Asked by ']
              )
            : 'No form asks it yet. Pick it for a question in the Questions tab of a form.'
        )
      );
    }

    function paintPane() {
      ui.clear(pane);
      pane.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'link-btn lists-back',
            name: 'all-lists',
            onclick: function () {
              st.open = false;
              st.creating = false;
              A.setHash('#/lists');
              paint();
            }
          },
          '‹ All lists'
        )
      );
      if (st.creating) {
        createPane().forEach(function (n) {
          if (n) pane.appendChild(n);
        });
        return;
      }
      pane.dataset.list = st.key;
      pane.appendChild(headPane());
      paintRows();
      pane.appendChild(rowsBox);
      pane.appendChild(problemBox);
      pane.appendChild(
        h(
          'p',
          { class: 'muted-note' },
          'A save reaches every form that asks this list. Answers already given are not changed.'
        )
      );
    }

    function paint() {
      wrap.classList.toggle('picked', st.open);
      paintPane();
      changed();
    }

    ui.clear(mount);
    mount.appendChild(h('div', { class: 'page-head' }, h('h2', null, 'Lists')));
    mount.appendChild(
      h(
        'p',
        { class: 'help' },
        'The choices of the dropdown questions. A list is shared: change it here and every form that asks it follows. Make more lists, such as another set of sections, and pick one for a question in the Questions tab of a form.'
      )
    );
    load(st.key);
    mount.appendChild(wrap);
    mount.appendChild(bar);
    paint();
  };
})((window.App = window.App || {}));
