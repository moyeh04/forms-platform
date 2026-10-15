/**
 * A question in the Questions list: Show and Required, its labels in both
 * languages, its kind, its description, its tools, and the list it reads.
 * The questions about each team member follow as rows of their own.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var Q = A.questions;
  var h = App.ui.h;

  /** How many parts a name has: the default and the bounds. */
  var NAME_PARTS = { DEFAULT: 4, MIN: 2, MAX: 6 };

  /**
   * Draws the description of a question in one language.
   *
   * @param {!Object} fd The question.
   * @param {string} lang 'en' or 'ar'.
   * @return {!Element} The textarea.
   */
  function descText(fd, lang) {
    var ar = lang === 'ar';
    return h(
      'textarea',
      {
        class: 'textarea',
        rows: '2',
        name: 'help-' + lang + '-' + fd.id,
        'aria-label': (ar ? 'Arabic' : 'English') + ' description for ' + fd.id,
        dir: ar ? 'rtl' : null,
        lang: ar ? 'ar' : null,
        placeholder: ar
          ? 'بالعربي'
          : 'English, for example: In case of 3 or 4, other students will' +
            ' be added to reach 5',
        oninput: function (e) {
          var patch = {};
          patch[lang] = e.target.value;
          fd.help = Object.assign({}, fd.help, patch);
        }
      },
      fd.help?.[lang] || ''
    );
  }

  /**
   * Draws the description of a question and the button that adds it. The
   * description stays hidden until it has text or the admin asks for it.
   *
   * @param {!Object} fd The question.
   * @param {boolean} sub True for a question about each team member.
   * @return {{row: !Element, button: !Element}} The two.
   */
  function description(fd, sub) {
    var d = {};
    d.row = h(
      'div',
      {
        class: 'q-desc' + (sub ? ' sub' : ''),
        dataset: { desc: fd.id },
        hidden: !Q.hasHelp(fd)
      },
      h(
        'span',
        { class: 'label' },
        'Description students see under this question'
      ),
      h('div', { class: 'desc-pair' }, descText(fd, 'en'), descText(fd, 'ar')),
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          onclick: function () {
            fd.help = { en: '', ar: '' };
            d.row.querySelectorAll('textarea').forEach(function (t) {
              t.value = '';
            });
            d.row.hidden = true;
            d.button.hidden = false;
          }
        },
        'Remove description'
      )
    );
    d.button = h(
      'button',
      {
        type: 'button',
        class: 'link-btn add-desc',
        name: 'desc-' + fd.id,
        hidden: Q.hasHelp(fd),
        onclick: function () {
          d.row.hidden = false;
          d.button.hidden = true;
          var first = d.row.querySelector('textarea');
          if (first) first.focus();
        }
      },
      '+ Description'
    );
    return d;
  }

  /**
   * Draws the button that unfolds the tools of a question.
   *
   * @param {!Object} s The settings page: `toolsOpen` keeps it unfolded
   *     when the list is drawn again.
   * @param {!Object} fd The question.
   * @param {!Element} tools The tools.
   * @return {!Element} The button.
   */
  function toolsButton(s, fd, tools) {
    var btn = h(
      'button',
      {
        type: 'button',
        class: 'link-btn add-desc',
        name: 'tools-' + fd.id,
        'aria-expanded': s.toolsOpen[fd.id] ? 'true' : 'false',
        onclick: function () {
          s.toolsOpen[fd.id] = tools.hidden;
          tools.hidden = !tools.hidden;
          btn.setAttribute('aria-expanded', tools.hidden ? 'false' : 'true');
        }
      },
      fd.custom ? 'Page and kind' : 'Page'
    );
    return btn;
  }

  /**
   * Draws the English and Arabic labels of a question.
   *
   * @param {!Object} fd The question.
   * @return {!Element} The labels.
   */
  function labels(fd) {
    return h(
      'div',
      { class: 'q-labels' },
      A.text(
        fd.label.en,
        function (v) {
          fd.label.en = v;
        },
        {
          'aria-label': 'English label for ' + fd.id,
          placeholder: fd.custom ? 'Your question, in English' : null
        }
      ),
      A.text(
        fd.label.ar,
        function (v) {
          fd.label.ar = v;
        },
        {
          'aria-label': 'Arabic label for ' + fd.id,
          dir: 'rtl',
          lang: 'ar',
          placeholder: fd.custom ? 'السؤال بالعربي' : null
        }
      )
    );
  }

  /**
   * Draws the kind of a question, or how many parts a name needs.
   *
   * @param {!Object} fd The question.
   * @return {!Element} The kind.
   */
  function kind(fd) {
    var name = Q.typeName(fd);
    if (fd.type !== 'arabic_name') {
      return h(
        'span',
        { class: 'q-type' },
        fd.custom ? 'Added · ' + name : name
      );
    }
    return h(
      'label',
      { class: 'q-parts' },
      A.number(
        fd.minParts || NAME_PARTS.DEFAULT,
        function (v) {
          fd.minParts = parseInt(v, 10) || NAME_PARTS.DEFAULT;
        },
        {
          class: 'input num',
          min: String(NAME_PARTS.MIN),
          max: String(NAME_PARTS.MAX),
          'aria-label': 'Name parts for ' + fd.id
        }
      ),
      'name parts'
    );
  }

  /**
   * Draws the Show switch. A question the form cannot work without has no
   * switches: it says so instead.
   *
   * @param {!Object} fd The question.
   * @param {function(): !Element} row Gives the row, to grey it out.
   * @return {!Element} The switch.
   */
  function showSwitch(fd, row) {
    if (Q.isLocked(fd)) {
      return h('span', { class: 'q-always' }, 'Always asked');
    }
    return A.check('Show', fd.enabled !== false, function (v) {
      fd.enabled = v;
      row().classList.toggle('off', !v);
    });
  }

  /**
   * Draws a question and what belongs under it.
   *
   * @param {!Object} s The settings page.
   * @param {!Object} fd The question.
   * @param {boolean} sub True for a question about each team member.
   * @return {!Array<?Element>} The row, its description, its tools, and
   *     the rows of the questions about each member.
   */
  Q.rows = function (s, fd, sub) {
    var desc = description(fd, sub);
    var tools = sub ? null : Q.toolsRow(s, fd);
    var row = h(
      'div',
      {
        class: 'q-row' + (sub ? ' sub' : '') + (fd.custom ? ' custom' : ''),
        dataset: { field: fd.id }
      },
      h(
        'div',
        { class: 'q-show' },
        showSwitch(fd, function () {
          return row;
        })
      ),
      labels(fd),
      h(
        'div',
        { class: 'q-opts' },
        Q.isLocked(fd)
          ? null
          : A.check('Required', fd.required !== false, function (v) {
              fd.required = v;
            }),
        kind(fd),
        desc.button,
        tools ? toolsButton(s, fd, tools) : null
      ),
      Q.listPicker(s, fd)
    );
    if (fd.enabled === false) row.classList.add('off');
    var out = [row, desc.row, tools];
    if (fd.type !== 'members') return out;
    (fd.fields || []).forEach(function (sf) {
      out = out.concat(Q.rows(s, sf, true));
    });
    return out;
  };
})(window.App);
