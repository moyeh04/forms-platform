/**
 * How long a private link works: the picker of its end, for a new link or
 * to move the end of one, and the dialog that moves it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var ui = App.ui;
  var h = ui.h;
  var toast = ui.toast;

  var LINK_PERIODS = [
    { days: 7, label: '1 week' },
    { days: 30, label: '1 month' },
    { days: 90, label: '3 months' }
  ];

  /**
   * Gives the end of a link as the server takes it. Periods count from
   * today.
   *
   * @param {?Object} choice The choice of the picker.
   * @return {string} An ISO time, or '' for no end.
   */
  A.linkEnd = function (choice) {
    if (!choice || choice.none) return '';
    return choice.until || A.extendedEnd('', choice);
  };

  /**
   * Says until when the chosen end lets the link work.
   *
   * @param {?Object} c The choice, or null while none is picked.
   * @return {string} The line.
   */
  function endText(c) {
    if (!c) return 'Pick the date the link ends.';
    var end = A.linkEnd(c);
    return end
      ? 'The link and its key work until ' + A.day(end) + '.'
      : 'The link works until you turn it off.';
  }

  /**
   * Draws the picker of how long a link works, with a line that says until
   * when.
   *
   * @param {?Object} start The choice it starts on.
   * @param {function(?Object)} onchange Called with each new choice.
   * @return {!Element} The picker.
   */
  A.linkEndPicker = function (start, onchange) {
    var preview = h(
      'p',
      { class: 'extend-preview', role: 'status' },
      endText(start)
    );
    var picker = A.untilPicker({
      name: 'link-end',
      none: 'No end date',
      periods: LINK_PERIODS,
      start: start,
      onchange: function (c) {
        preview.textContent = endText(c);
        onchange(c);
      }
    });
    return h('div', null, picker.node, preview);
  };

  /**
   * Gives the choice the dialog starts on: the end of a link that still
   * works, nothing for one that ended, or no end.
   *
   * @param {!Object} c The client.
   * @return {?Object} The choice.
   */
  function startOf(c) {
    if (!c.expires) return { none: true };
    return c.expired ? null : { until: c.expires };
  }

  /**
   * Opens the dialog that moves the end of a link. A link that ended opens
   * again with a new end.
   *
   * @param {!Object} c The client.
   */
  A.linkEndDialog = function (c) {
    var choice = startOf(c);

    /**
     * Saves the new end, or refuses while none is picked.
     *
     * @return {!Promise<boolean|undefined>} False to keep the dialog open.
     */
    async function save() {
      if (!choice) {
        toast('Pick the date the link ends.', 'err');
        return false;
      }
      await A.call('admin.clients.update', {
        id: c.id,
        patch: { expires: A.linkEnd(choice) }
      });
      toast('Saved', 'ok');
      A.render();
    }

    A.modal(
      'When the link of ' + c.name + ' ends',
      h(
        'div',
        { class: 'l-stack' },
        c.expired
          ? h(
              'p',
              null,
              A.untilText(c.expires),
              '. Pick a new end to open it again.'
            )
          : null,
        A.linkEndPicker(choice, function (v) {
          choice = v;
        })
      ),
      [
        { text: 'Cancel', kind: 'quiet' },
        { text: 'Save', kind: 'primary', onclick: save }
      ]
    );
  };
})(window.App);
