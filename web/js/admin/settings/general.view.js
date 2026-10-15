/**
 * The Name and dates panel of a form: its title, its subject and term, its
 * link name, when it opens and closes, its language and its icon.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  var LANGUAGES = [
    ['en', 'English'],
    ['ar', 'Arabic']
  ];

  var ICONS = [
    ['team', 'Team'],
    ['calendar', 'Calendar'],
    ['task', 'Task'],
    ['chat', 'Chat'],
    ['none', 'None']
  ];

  /**
   * Writes a number with two digits.
   *
   * @param {number} n The number.
   * @return {string} "07", "12".
   */
  function p2(n) {
    return ('0' + n).slice(-2);
  }

  /**
   * Writes a moment as a datetime-local input takes it, in local time.
   *
   * @param {string} iso The moment.
   * @return {string} YYYY-MM-DDTHH:MM, or '' when there is none.
   */
  function toLocal(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return (
      d.getFullYear() +
      '-' +
      p2(d.getMonth() + 1) +
      '-' +
      p2(d.getDate()) +
      'T' +
      p2(d.getHours()) +
      ':' +
      p2(d.getMinutes())
    );
  }

  /**
   * Reads a datetime-local value as a moment.
   *
   * @param {string} v The value.
   * @return {string} The moment as ISO, or '' when there is none.
   */
  function fromLocal(v) {
    if (!v) return '';
    var d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  /**
   * Draws when the form opens or closes.
   *
   * @param {!Object} f The form, changed in place.
   * @param {string} key 'opensAt' or 'closesAt'.
   * @param {string} label The label.
   * @param {string} help What an empty value means.
   * @return {!Element} The field.
   */
  function momentField(f, key, label, help) {
    return A.field(
      label,
      h('input', {
        class: 'input',
        type: 'datetime-local',
        name: key,
        value: toLocal(f[key]),
        onchange: function (e) {
          f[key] = fromLocal(e.target.value);
        }
      }),
      help
    );
  }

  /**
   * Draws the language, the icon and the language switch of the form.
   *
   * @param {!Object} f The form, changed in place.
   * @return {!Element} The row.
   */
  function looksRow(f) {
    return h(
      'div',
      { class: 'row' },
      A.field(
        'Form language',
        A.select(f.lang.default, LANGUAGES, function (v) {
          f.lang.default = v;
        })
      ),
      A.field(
        'Header icon',
        A.select(f.icon || 'none', ICONS, function (v) {
          f.icon = v;
        })
      ),
      h(
        'div',
        { class: 'field-row' },
        A.check(
          'Show the language switch to students',
          f.lang.allowSwitch !== false,
          function (v) {
            f.lang.allowSwitch = v;
          }
        )
      )
    );
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} f The form.
   * @return {string} The title and the dates.
   */
  function summary(f) {
    /**
     * Writes a moment for the folded line.
     *
     * @param {string} iso The moment.
     * @return {string} YYYY-MM-DD HH:MM.
     */
    function when(iso) {
      return toLocal(iso).replace('T', ' ');
    }

    return [
      f.title,
      f.opensAt ? 'opens ' + when(f.opensAt) : '',
      f.closesAt ? 'closes ' + when(f.closesAt) : ''
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /**
   * Draws the Name and dates panel.
   *
   * @param {!Object} s The settings page: `f` and `metadata`.
   * @return {!Element} The panel.
   */
  A.generalPanel = function (s) {
    var f = s.f;
    var panel = A.panel(
      'Name and dates',
      'Students can only submit while the status is Open and the current' +
        ' time is inside the dates below.',
      A.field(
        'Title',
        A.text(
          f.title,
          function (v) {
            f.title = v;
          },
          { name: 'title' }
        ),
        'The heading students see.'
      ),
      A.metadataEditor(f.type, s.metadata, function (v) {
        Object.assign(s.metadata, v);
      }),
      A.field(
        'Link name',
        A.text(
          f.slug,
          function (v) {
            f.slug = v;
          },
          { name: 'slug', dir: 'ltr' }
        ),
        'The form address ends with ?f= and this name. Changing it breaks' +
          ' links already shared.'
      ),
      h(
        'div',
        { class: 'row' },
        momentField(
          f,
          'opensAt',
          'Opens at',
          'Leave empty to open as soon as the status is Open.'
        ),
        momentField(
          f,
          'closesAt',
          'Closes at',
          'Leave empty to stay open until you close it.'
        )
      ),
      looksRow(f)
    );
    panel.summary = summary.bind(null, f);
    return panel;
  };
})(window.App);
