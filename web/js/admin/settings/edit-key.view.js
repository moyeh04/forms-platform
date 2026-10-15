/**
 * The Edit key panel of a form: whether students get a key that opens
 * their registration, how long a new key works, and what it lets them do.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /** How many days a new key works: the default and the bounds. */
  var KEY_DAYS = { DEFAULT: 7, MIN: 1, MAX: 90 };

  /**
   * Draws a switch of what a key lets students do.
   *
   * @param {!Object} key The key settings, changed in place.
   * @param {string} name 'allowEdit' or 'allowDelete'.
   * @param {string} label The label.
   * @return {!Element} The switch.
   */
  function allowSwitch(key, name, label) {
    return h(
      'div',
      { class: 'field-row' },
      A.check(label, key[name], function (v) {
        key[name] = v;
      })
    );
  }

  /**
   * Draws the settings shown while keys are on. The keys already given are
   * counted from the saved form: a key switched on but not saved has none
   * yet.
   *
   * @param {!Object} f The form.
   * @return {!Element} The settings.
   */
  function keyMore(f) {
    var key = f.editKey;
    return h(
      'div',
      { class: 'key-more', hidden: !key.enabled },
      A.field(
        'A new key works for (days)',
        A.number(
          key.days,
          function (v) {
            key.days = parseInt(v, 10) || KEY_DAYS.DEFAULT;
          },
          {
            name: 'keyDays',
            min: String(KEY_DAYS.MIN),
            max: String(KEY_DAYS.MAX)
          }
        ),
        'Counted from when the key is given. To give keys already sent more' +
          ' time, use Extend keys.'
      ),
      h(
        'div',
        { class: 'row' },
        allowSwitch(key, 'allowEdit', 'Students may change their answers'),
        allowSwitch(
          key,
          'allowDelete',
          'Students may cancel their registration'
        )
      ),
      key.enabled && f.id ? A.keysSummary(f) : null
    );
  }

  /**
   * Gives the folded line of the panel.
   *
   * @param {!Object} key The key settings.
   * @return {string} Off, or on with its days and what students may do.
   */
  function summary(key) {
    if (!key.enabled) return 'Off';
    var may = [key.allowEdit ? 'edit' : '', key.allowDelete ? 'cancel' : '']
      .filter(Boolean)
      .join(' and ');
    return (
      'On, ' +
      A.plural(key.days, 'day', 'days') +
      (may ? ', students can ' + may : ', students cannot change anything')
    );
  }

  /**
   * Draws the Edit key panel. f.editKey is filled in.
   *
   * @param {!Object} s The settings page: `f`.
   * @return {!Element} The panel.
   */
  A.editKeyPanel = function (s) {
    var f = s.f;
    f.editKey = f.editKey || {
      enabled: true,
      days: KEY_DAYS.DEFAULT,
      allowEdit: true,
      allowDelete: true
    };
    var more = keyMore(f);
    var panel = A.panel(
      'Edit key',
      'Each student gets a 5-digit key on the success page and by email. The' +
        ' key alone opens their registration.',
      h(
        'div',
        { class: 'field-row' },
        A.check('Give students an edit key', f.editKey.enabled, function (v) {
          f.editKey.enabled = v;
          more.hidden = !v;
        })
      ),
      more
    );
    panel.summary = summary.bind(null, f.editKey);
    return panel;
  };
})(window.App);
