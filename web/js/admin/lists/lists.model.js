/**
 * The shared lists behind dropdown questions, as data: the lists that came
 * with the platform, the kinds a list can be, and how a saved list turns
 * into the rows the editor holds and back.
 *
 * A list has a kind, and the kind decides how it is edited, so most lists
 * need no typing:
 *   sections  built from year groups (4C, 3L) and how many sections of
 *             each kind (TH, T …) they have
 *   numbers   a run from one number to another
 *   named     choices with an English name (majors, levels), as rows
 *   plain     short choices (groups, bylaws), as chips
 *   milestones the steps of a project, by name only; each keeps a random
 *             id, because the marks of every team are kept by it
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var L = {};
  A.lists = L;

  var ALL_TYPES = [
    'team_registration',
    'task_submission',
    'reservation',
    'whatsapp_registration'
  ];
  var FORM_TYPES = ['team_registration', 'task_submission', 'reservation'];

  /** How a milestone id is made: base 36, which letters of it are kept. */
  var ID = { RADIX: 36, FROM: 2, TO: 10 };

  /**
   * The lists that came with the platform: their names, what they are
   * for, and their kind.
   */
  L.BUILTIN = {
    levels: {
      name: 'Levels',
      about: 'The level or year question.',
      kind: ListKind.NAMED,
      types: ALL_TYPES
    },
    curricula: {
      name: 'Bylaws',
      about: 'The bylaw (curriculum year) question.',
      kind: ListKind.PLAIN,
      types: FORM_TYPES
    },
    majors: {
      name: 'Majors',
      about:
        'Specializations. A form can also be limited to some of them in its' +
        ' setup.',
      kind: ListKind.NAMED,
      types: ALL_TYPES
    },
    sections: {
      name: 'Sections',
      about:
        'Lecture sections such as 4C-TH1. A form can also be limited to some' +
        ' of them in its setup.',
      kind: ListKind.SECTIONS,
      types: FORM_TYPES
    },
    groups: {
      name: 'Groups',
      about: 'WhatsApp group letters (A with Chemistry, B without).',
      kind: ListKind.PLAIN,
      types: ['whatsapp_registration']
    },
    wa_sections: {
      name: 'WhatsApp section numbers',
      about: 'The number next to TH in a student timetable.',
      kind: ListKind.NUMBERS,
      types: ['whatsapp_registration']
    }
  };

  /** The kinds a list can be, as the New list cards show them. */
  L.KINDS = {
    sections: {
      label: 'Sections',
      example: '4C-TH1, 4C-T1, 3L-TH1',
      about:
        'Built from year groups and how many of each kind they have. Nothing' +
        ' to type.'
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
    },
    milestones: {
      label: 'Milestones',
      example: 'Task 1, Task 2, Task 3',
      about:
        'Milestones of a project. A form copies these milestones when it' +
        ' picks the list.'
    }
  };

  /**
   * Makes the id of a new milestone. It is random, so the id of a removed
   * milestone never comes back with other marks.
   *
   * @param {!Array<string>} taken The ids in use.
   * @return {string} The id.
   */
  L.newMilestoneId = function (taken) {
    var id;
    do {
      id = 'm_' + Math.random().toString(ID.RADIX).slice(ID.FROM, ID.TO);
    } while (taken.indexOf(id) !== -1);
    return id;
  };

  /**
   * Gives the kind of a list, for this page and for the Questions tab.
   *
   * @param {string} key The list.
   * @param {?Object} info The names and kinds of the lists the admin made.
   * @return {string} The kind.
   */
  A.listKind = function (key, info) {
    return info?.[key]?.kind || L.BUILTIN[key]?.kind || 'plain';
  };

  /**
   * Whether a question may be pointed at this list instead of its own. A
   * list the admin made may always be picked; a built-in one only when it
   * is the only built-in of its kind (Sections, the WhatsApp numbers),
   * because Levels and Majors, or Bylaws and Groups, mean different
   * things.
   *
   * @param {string} key The list.
   * @return {boolean} True when it may be picked.
   */
  A.listSwappable = function (key) {
    if (Object.keys(L.BUILTIN).indexOf(key) === -1) return true;
    return (
      Object.keys(L.BUILTIN).filter(function (k) {
        return L.BUILTIN[k].kind === L.BUILTIN[key].kind;
      }).length === 1
    );
  };

  /**
   * Gives the name of a list.
   *
   * @param {string} key The list.
   * @param {?Object} info The names and kinds of the lists the admin made.
   * @return {string} The name, or the key.
   */
  A.listName = function (key, info) {
    return info?.[key]?.name || L.BUILTIN[key]?.name || key;
  };

  /**
   * Whether questions, or the questions inside them, read a list.
   *
   * @param {?Array<!Object>} fields The questions.
   * @param {string} key The list.
   * @return {boolean} True when one does.
   */
  function uses(fields, key) {
    return (fields || []).some(function (x) {
      return x.list === key || uses(x.fields, key);
    });
  }

  /**
   * Keeps the forms that are not archived and ask a list.
   *
   * @param {!Array<!Object>} forms Every form.
   * @param {string} key The list.
   * @return {!Array<!Object>} The forms.
   */
  L.formsUsing = function (forms, key) {
    return forms.filter(function (f) {
      return f.status !== FormStatus.ARCHIVED && uses(f.fields, key);
    });
  };

  /**
   * Gives the name a missing Arabic name repeats: the value, or for a
   * milestone, whose value is an id, its English name.
   *
   * @param {string} value The value.
   * @param {string} en The English name.
   * @param {string=} kind The kind of the list.
   * @return {string} The name.
   */
  function arFallback(value, en, kind) {
    return kind === ListKind.MILESTONES ? en : value;
  }

  /**
   * Gives a saved list as the editor holds it: a name that only repeats
   * the value is left empty.
   *
   * @param {?Array<!Object>} values The saved choices.
   * @param {string=} kind The kind of the list.
   * @return {!Array<!Object>} The rows: value, en and ar.
   */
  L.toRows = function (values, kind) {
    return (values || []).map(function (o) {
      var label = o.label || {};
      var v = String(o.value);
      var en = label.en && label.en !== v ? label.en : '';
      var same = arFallback(v, en, kind);
      return {
        value: v,
        en: en,
        ar: label.ar && label.ar !== same ? label.ar : ''
      };
    });
  };

  /**
   * Gives the rows as the list is saved: empty rows are left out and a
   * missing name repeats the value.
   *
   * @param {!Array<!Object>} rows The rows.
   * @param {string=} kind The kind of the list.
   * @return {!Array<!Object>} The choices.
   */
  L.fromRows = function (rows, kind) {
    return rows
      .filter(function (r) {
        return r.value.trim();
      })
      .map(function (r) {
        var v = r.value.trim();
        var en = r.en.trim() || v;
        return {
          value: v,
          label: { en: en, ar: r.ar.trim() || arFallback(v, en, kind) }
        };
      });
  };

  /**
   * Gives values as rows without names.
   *
   * @param {!Array<*>} values The values.
   * @return {!Array<!Object>} The rows.
   */
  L.plainRows = function (values) {
    return values.map(function (v) {
      return { value: String(v), en: '', ar: '' };
    });
  };

  /**
   * Reads pasted lines as rows; "value | English name" gives the choice a
   * name.
   *
   * @param {string} text The pasted text.
   * @return {!Array<!Object>} The rows.
   */
  L.parse = function (text) {
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
  };
})(window.App);
