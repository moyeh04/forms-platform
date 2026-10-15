/**
 * The Who can register panel: limits a form to some specializations and
 * some sections. Each limit is offered only when a question of the form
 * reads that list.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;

  /**
   * Names an option of a list.
   *
   * @param {!Object} o The option.
   * @return {string} Its English text, or its value.
   */
  function label(o) {
    return o.label?.en || o.value;
  }

  /**
   * Tells whether a shown question, or a shown question about each member,
   * reads a list.
   *
   * @param {!Object} f The form.
   * @param {string} list The list.
   * @return {boolean} True when one does.
   */
  function readsList(f, list) {
    return (f.fields || []).some(function (x) {
      return [x].concat(x.fields || []).some(function (y) {
        return y.list === list && y.enabled !== false;
      });
    });
  }

  /**
   * Finds the list of sections the section question reads. The section rule
   * applies to whichever list that is.
   *
   * @param {!Object} s The settings page.
   * @return {string} The list, or ''.
   */
  function sectionList(s) {
    var key = '';
    (s.f.fields || []).forEach(function (x) {
      [x].concat(x.fields || []).forEach(function (y) {
        if (
          !key &&
          y.list &&
          y.enabled !== false &&
          A.listKind(y.list, s.res.listInfo) === ListKind.SECTIONS
        ) {
          key = y.list;
        }
      });
    });
    return key;
  }

  /**
   * Gives the options of a list.
   *
   * @param {!Object} s The settings page.
   * @param {string} key The list, or ''.
   * @return {!Array<!Object>} The options.
   */
  function optionsOf(s, key) {
    return key ? s.res.lists?.[key] || [] : [];
  }

  /**
   * Lists the names of the chosen specializations.
   *
   * @param {!Object} w The panel.
   * @return {!Array<string>} The names.
   */
  function majorNames(w) {
    return w.majors
      .filter(function (o) {
        return w.f.rules.majors.indexOf(String(o.value)) !== -1;
      })
      .map(label);
  }

  /**
   * Says which specializations can register.
   *
   * @param {!Object} w The panel.
   * @return {string} The note.
   */
  function majorNote(w) {
    var names = majorNames(w);
    if (!names.length) return 'Students of every specialization can register.';
    if (names.length === 1) {
      return (
        'Only ' +
        names[0] +
        ' students can register. The Major question is filled in for them' +
        ' and locked.'
      );
    }
    return 'Only ' + names.join(' and ') + ' students can register.';
  }

  /**
   * Draws the specializations part.
   *
   * @param {!Object} w The panel.
   * @return {!Array<!Element>} Its parts.
   */
  function majorsPart(w) {
    var f = w.f;
    f.rules.majors = Array.isArray(f.rules.majors)
      ? f.rules.majors.slice()
      : [];
    var note = h('p', { class: 'muted-note' }, majorNote(w));
    return [
      h('h3', null, 'Specializations'),
      h(
        'p',
        { class: 'help' },
        'The choices come from the Majors list. Students of other' +
          ' specializations cannot submit.'
      ),
      A.allowPicker({
        name: 'major',
        all: 'All specializations',
        options: w.majors,
        get: function () {
          return f.rules.majors;
        },
        set: function (v) {
          f.rules.majors = v;
          note.textContent = majorNote(w);
        }
      }),
      note
    ];
  }

  /**
   * Says which sections students choose from.
   *
   * @param {!Object} w The panel.
   * @return {string} The note.
   */
  function sectionNote(w) {
    var chosen = w.f.rules.sections;
    if (chosen.length) {
      return (
        'Students choose from ' +
        A.plural(chosen.length, 'section', 'sections') +
        '. The other sections are not offered and are refused.'
      );
    }
    return (
      'Students choose from every section in the list ' +
      A.listName(sectionList(w.s), w.s.res.listInfo) +
      '.'
    );
  }

  /**
   * Draws the sections part again, for the list the section question reads
   * now. Chosen sections that list does not have are dropped.
   *
   * @param {!Object} w The panel: `help`, `box` and `note` of the part.
   */
  function paintSections(w) {
    var f = w.f;
    var key = sectionList(w.s);
    w.sections = optionsOf(w.s, key);
    f.rules.sections = f.rules.sections.filter(function (v) {
      return w.sections.some(function (o) {
        return String(o.value) === v;
      });
    });
    ui.clear(w.help);
    w.help.append(
      'Pick the sections this form is for; they can be from more than one' +
        ' year. The choices come from the list ' +
        A.listName(key, w.s.res.listInfo) +
        '. ',
      h(
        'a',
        { href: '#/lists/' + encodeURIComponent(key) },
        'Change the sections in Lists.'
      )
    );
    ui.clear(w.box);
    w.box.appendChild(
      A.allowPicker({
        name: 'section',
        all: 'All sections',
        options: w.sections,
        groupOf: A.sectionGroup,
        get: function () {
          return f.rules.sections;
        },
        set: function (v) {
          f.rules.sections = v;
          w.note.textContent = sectionNote(w);
        }
      })
    );
    w.note.textContent = sectionNote(w);
  }

  /**
   * Draws the sections part. It is drawn again when the section question
   * is pointed at another list in the Questions tab.
   *
   * @param {!Object} w The panel.
   * @return {!Array<!Element>} Its parts.
   */
  function sectionsPart(w) {
    var f = w.f;
    f.rules.sections = Array.isArray(f.rules.sections)
      ? f.rules.sections.slice()
      : [];
    w.help = h('p', { class: 'help' });
    w.box = h('div');
    w.note = h('p', { class: 'muted-note' });
    w.s.paintSectionRule = paintSections.bind(null, w);
    w.s.paintSectionRule();
    return [h('h3', null, 'Sections'), w.help, w.box, w.note];
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} w The panel.
   * @return {string} The limits, or 'Everyone'.
   */
  function summary(w) {
    var f = w.f;
    var parts = [];
    var groups = [];
    if (w.majors.length && f.rules.majors.length) {
      parts.push('Only ' + majorNames(w).join(', '));
    }
    if (w.sections.length && f.rules.sections.length) {
      f.rules.sections.forEach(function (v) {
        var g = A.sectionGroup({ value: v });
        if (groups.indexOf(g) === -1) groups.push(g);
      });
      parts.push(
        A.plural(f.rules.sections.length, 'section', 'sections') +
          ' (' +
          groups.join(', ') +
          ')'
      );
    }
    return parts.length ? parts.join(' · ') : 'Everyone';
  }

  /** Draws no section rule: no section limit is offered. */
  function noSections() {
    // Nothing to draw.
  }

  /**
   * Draws the Who can register panel. It sets `paintSectionRule()` on the
   * settings page; that does nothing when there is no section limit.
   *
   * @param {!Object} s The settings page: `f` and `res`.
   * @return {?Element} The panel, or null when no question reads a list
   *     it can limit.
   */
  A.whoPanel = function (s) {
    var w = {
      s: s,
      f: s.f,
      majors: readsList(s.f, 'majors') ? s.res.lists?.majors || [] : [],
      sections: optionsOf(s, sectionList(s))
    };
    s.paintSectionRule = noSections;
    if (!w.majors.length && !w.sections.length) return null;
    var body = [];
    if (w.majors.length) body = body.concat(majorsPart(w));
    if (w.sections.length) body = body.concat(sectionsPart(w));
    var panel = A.panel(
      'Who can register',
      'Limit this form to some students. With no limit, every choice of the' +
        ' list is offered.',
      body
    );
    panel.summary = summary.bind(null, w);
    return panel;
  };
})(window.App);
