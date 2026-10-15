/**
 * The success ticket: the reference, the picture of a booking, the key
 * with a callout and its expiry, and the buttons that save, print or copy
 * it. Loaded last of the ticket parts.
 */
(function (App) {
  'use strict';

  var T = App.ticket;
  var h = App.ui.h;

  /** The size of the icons on the buttons, in pixels. */
  var BUTTON_ICON_SIZE = 20;

  /** The hand-drawn arrow that points from the note down to the key. */
  var CALLOUT_ARROW =
    '<svg viewBox="0 0 44 60" width="40" height="54" fill="none"' +
    ' stroke="currentColor" stroke-width="2.4" stroke-linecap="round"' +
    ' stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M22 3c7 11-6 23 0 40"/><path d="M11 35l11 12 11-12"/></svg>';

  /**
   * Looks up a sentence in the language of the page.
   *
   * @param {string} k The key.
   * @param {!Object=} p The values it takes.
   * @return {string} The sentence.
   */
  function t(k, p) {
    return App.i18n.t(k, p);
  }

  /**
   * Draws the arrow from the note to the key.
   *
   * @return {!Element} The arrow.
   */
  function arrowCallout() {
    var s = h('span', { class: 'callout-arrow' });
    s.innerHTML = CALLOUT_ARROW;
    return s;
  }

  /**
   * Draws the digits of a key in boxes. A screen reader hears the digits
   * one by one from the hidden text; the drawn boxes are for the eye.
   *
   * @param {string} key The key.
   * @return {!Element} The digits.
   */
  function digits(key) {
    return h(
      'div',
      { class: 'key-digits' },
      h('span', { class: 'sr-only' }, key.split('').join(' ')),
      key.split('').map(function (d) {
        return h('span', { class: 'key-digit code', 'aria-hidden': 'true' }, d);
      })
    );
  }

  /**
   * Draws the key with its note, its arrow and the date it ends.
   *
   * @param {!Object} o The ticket.
   * @return {!Element} The key.
   */
  function keyBlock(o) {
    return h(
      'div',
      { class: 'key-block' },
      h(
        'div',
        { class: 'key-note' },
        h('span', { class: 'key-note-text' }, t('ticketKeyNote')),
        arrowCallout()
      ),
      h('p', { class: 'key-label' }, t('ticketKey')),
      digits(o.key),
      h(
        'p',
        { class: 'help' },
        t('ticketValid', { date: App.i18n.fmtDate(o.keyExpires) })
      )
    );
  }

  /**
   * Draws what the ticket says about a key: the key itself, the note that
   * the team's key still works, or that this registration has none.
   *
   * @param {!Object} o The ticket.
   * @return {!Array<!Element>} The lines; none for an edit or a booking
   *     without a key.
   */
  function keyPart(o) {
    if (o.key) {
      return [keyBlock(o), h('p', { class: 'shot-note' }, t('ticketShot'))];
    }
    if (o.teamKey) {
      return [
        h('p', { class: 'help', name: 'team-key-note' }, t('ticketTeamKey'))
      ];
    }
    if (!o.edited && !o.when) return [h('p', null, t('ticketNoKey'))];
    return [];
  }

  /**
   * Draws the answers under the key.
   *
   * @param {!Array<{label: string, value: *}>} rows The answers.
   * @return {!Element} The list.
   */
  function summary(rows) {
    return h(
      'dl',
      { class: 'summary' },
      rows.map(function (r) {
        return [h('dt', null, r.label), h('dd', null, r.value)];
      })
    );
  }

  /**
   * Draws the ticket.
   *
   * @param {!Object} o The ticket: `ref`, and when they apply `edited`,
   *     `when` (the day and time of a booking, drawn under the title),
   *     `key` with `keyExpires`, `teamKey`, `email`, and `summary` (the rows
   *     shown under the key).
   * @return {!Element} The ticket.
   */
  function render(o) {
    var kids = [
      h(
        'h2',
        { class: 'ticket-title' },
        t(o.edited ? 'savedTitle' : 'ticketTitle')
      ),
      h(
        'p',
        { class: 'ticket-ref' },
        h('span', { class: 'muted' }, t('ticketRef') + '  '),
        h('span', { class: 'code' }, o.ref)
      )
    ];
    if (o.when) kids.push(T.when(o.when));
    kids.push(...keyPart(o));
    if (o.email) {
      kids.push(h('p', { class: 'help' }, t('emailSent', { email: o.email })));
    }
    if (o.summary?.length) kids.push(summary(o.summary));
    return h('section', { class: 'ticket', id: 'ticket' }, kids);
  }

  /**
   * Makes a button under the ticket.
   *
   * @param {string} look The class of its look.
   * @param {string} iconName Its icon.
   * @param {string} label The key of its words.
   * @param {function()} onclick What it does.
   * @return {!Element} The button.
   */
  function button(look, iconName, label, onclick) {
    return h(
      'button',
      { type: 'button', class: 'btn ' + look, onclick: onclick },
      App.ui.icon(iconName, BUTTON_ICON_SIZE),
      t(label)
    );
  }

  /**
   * Draws the buttons under the ticket: save it as an image, print it to
   * a PDF, and copy the key when it has one.
   *
   * @param {!Object} o The ticket.
   * @return {!Element} The buttons.
   */
  function actions(o) {
    /** Saves the ticket as an image, or says it could not. */
    async function save() {
      try {
        await T.saveImage(document.getElementById('ticket'), o.ref);
      } catch {
        App.ui.toast(t('imageFail'), 'err');
      }
    }

    /** Copies the key. */
    async function copy() {
      var ok = await App.ui.copyText(o.key);
      if (ok) App.ui.toast(t('copied'), 'ok');
    }

    /** Opens the print dialog, where the ticket is kept as a PDF. */
    function print() {
      window.print();
    }

    return h(
      'div',
      { class: 'ticket-actions' },
      button('btn-primary', 'download', 'saveImage', save),
      button('btn-quiet', 'printer', 'savePdf', print),
      o.key ? button('btn-quiet', 'copy', 'copyKey', copy) : null
    );
  }

  T.render = render;
  T.actions = actions;
})(window.App);
