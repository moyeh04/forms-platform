/**
 * What each kind of form shows beside its title, as the dashboard edits
 * it: a term with a subject code, or a batch year. FormMetadata says which
 * editor a kind of form uses.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /** The editors, by the name FormMetadata gives them. */
  A.METADATA_EDITORS = {};

  /**
   * Lists the academic years a form can be for.
   *
   * @param {string=} current The year the form has now, kept in the list.
   * @return {!Array<string>} The years.
   */
  function yearOptions(current) {
    return FormMetadata.academicYears(current);
  }

  /**
   * Draws the season chips of a term. Picking the season that is on turns
   * it off.
   *
   * @param {!Element} chips The box of the chips.
   * @param {!Object} st The term being edited.
   * @param {function()} changed Draws the term again and reports it.
   */
  function paintSeasons(chips, st, changed) {
    App.ui.clear(chips);
    A.SEASONS.forEach(function (s) {
      var on = st.season === s;
      chips.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'toggle-chip',
            role: 'radio',
            name: 'season-' + s.toLowerCase(),
            'aria-checked': on ? 'true' : 'false',
            'aria-pressed': on ? 'true' : 'false',
            onclick: function () {
              st.season = on ? '' : s;
              st.custom = '';
              changed();
            }
          },
          s
        )
      );
    });
  }

  /**
   * Draws the subject code box: optional, with no spaces.
   *
   * @param {string} subject The code.
   * @param {function(string)} onchange Called with the new code.
   * @return {!Element} The field.
   */
  function subjectField(subject, onchange) {
    var box = A.text(
      subject,
      function (v) {
        onchange(v.replace(/\s+/g, ''));
      },
      {
        name: 'subject',
        placeholder: 'CS101',
        dir: 'ltr',
        autocomplete: 'off',
        spellcheck: 'false'
      }
    );
    return h(
      'label',
      { class: 'field-row term-subject' },
      h('span', { class: 'label' }, 'Subject code'),
      box,
      h(
        'span',
        { class: 'help' },
        'Optional. A short code shown beside the title. No spaces.'
      )
    );
  }

  /**
   * Edits a term (a season and an academic year) and a subject code. A
   * term in another shape is shown until a season is picked.
   *
   * @param {!Object} o The values: `term`, `subject`.
   * @param {function(!Object)} onchange Called with `{term, subject}`.
   * @return {!Element} The editor.
   */
  A.METADATA_EDITORS['term-subject'] = function (o, onchange) {
    var st = FormMetadata.termParts(o.term);
    var subject = o.subject || '';
    if (!st.year) st.year = yearOptions()[0];

    /** Reports the term and the subject. */
    function emit() {
      var term = st.season ? st.season + ' ' + st.year : st.custom;
      onchange({ term: term, subject: subject });
    }

    var chips = h('div', {
      class: 'toggle-chips season-chips',
      role: 'radiogroup',
      'aria-label': 'Term'
    });
    var custom = h('p', { class: 'muted-note' });
    var yearSel = A.select(st.year, yearOptions(st.year), function (v) {
      st.year = v;
      emit();
    });
    yearSel.name = 'termYear';
    yearSel.setAttribute('aria-label', 'Year');

    /** Draws the seasons, the term in another shape, and the year. */
    function paint() {
      paintSeasons(chips, st, function () {
        paint();
        emit();
      });
      custom.textContent =
        !st.season && st.custom
          ? 'Current term: "' + st.custom + '". Pick a season to replace it.'
          : '';
      yearSel.disabled = !st.season;
    }

    paint();
    return h(
      'div',
      { class: 'term-picker' },
      h(
        'div',
        { class: 'field-row term-season' },
        h('span', { class: 'label' }, 'Term'),
        chips,
        custom
      ),
      h(
        'label',
        { class: 'field-row term-year' },
        h('span', { class: 'label' }, 'Year'),
        yearSel
      ),
      subjectField(subject, function (v) {
        subject = v;
        emit();
      })
    );
  };

  /**
   * Edits the batch year of a form.
   *
   * @param {!Object} o The values: `batchYear`.
   * @param {function(!Object)} onchange Called with `{batchYear}`.
   * @return {!Element} The editor.
   */
  A.METADATA_EDITORS['batch-year'] = function (o, onchange) {
    var select = A.select(
      o.batchYear || yearOptions()[0],
      yearOptions(o.batchYear),
      function (v) {
        onchange({ batchYear: v });
      }
    );
    select.name = 'batchYear';
    select.setAttribute('aria-label', 'Batch year');
    return h(
      'div',
      { class: 'metadata-picker batch-year-picker' },
      A.field('Batch year', select)
    );
  };

  /**
   * Draws the editor a kind of form uses for what it shows beside its
   * title.
   *
   * @param {string} type The kind of form.
   * @param {!Object} values The values it has.
   * @param {function(!Object)} onchange Called with the changed values.
   * @return {!Element} The editor.
   */
  A.metadataEditor = function (type, values, onchange) {
    var adapter = FormMetadata.forType(type);
    var editor = A.METADATA_EDITORS[adapter.editor];
    return editor(values, onchange);
  };

  /**
   * Draws what a form shows beside its title as small tags.
   *
   * @param {!Object} f The form.
   * @return {!Array<!Element>} The tags.
   */
  A.termTags = function (f) {
    return FormMetadata.display(f).map(function (item) {
      return h(
        'span',
        {
          class: 'tag-sm' + (item.variant === 'subject' ? ' tag-subject' : '')
        },
        item.value
      );
    });
  };
})(window.App);
