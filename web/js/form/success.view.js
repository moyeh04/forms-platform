/**
 * The page after sending: the ticket with the key, and the day and time of a
 * booking for its picture.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /**
   * Gives the day and time of a booking, for the picture on its ticket.
   *
   * @return {?{day: !Object, time: string}} The slot, or null.
   */
  function bookedWhen() {
    var sf = P.slotField();
    var v = sf && S.data[sf.id];
    if (!v) return null;
    var slots = S.form.slots || {};
    var day = (slots.days || []).filter(function (d) {
      return d.id === v.day;
    })[0];
    return day && v.time ? { day: day, time: v.time } : null;
  }

  /**
   * Gives what the ticket shows. A booking made with a team's key answers
   * to that key, which the team has already; a new key is shown.
   *
   * @return {!Object} The ticket, as App.ticket.render takes it.
   */
  function ticketOptions() {
    var em = Rules.valueByRole(S.form, S.data, 'email');
    var r = S.result;
    var key = S.form.keyBooking && r.key === S.sourceKey ? '' : r.key;
    return {
      ref: r.ref,
      key: key,
      keyExpires: r.keyExpires,
      edited: !!r.edited,
      when: bookedWhen(),
      teamKey: !!S.form.keyBooking && !key && !r.edited,
      email: !r.edited && r.emailed ? em : '',
      summary: P.ticketSummary()
    };
  }

  /**
   * Draws the note about the members asked for from other teams.
   *
   * @return {?Element} The note, or null when none was asked for.
   */
  function transferNote() {
    var asked = S.result.transfers || [];
    if (!asked.length) return null;
    var list = asked
      .map(function (a) {
        return P.who(a.name, a.code) + ' → ' + a.team;
      })
      .join(t('listSep'));
    return h(
      'div',
      { class: 'banner info', role: 'status', name: 'transfer-sent' },
      t('transferSent', { list: list }),
      P.leaderContacts(asked)
    );
  }

  /**
   * Draws the page after sending: the ticket and what can be done with it.
   *
   * @return {!Element} The sheet.
   */
  function ticketView() {
    var opts = ticketOptions();
    return P.sheet(
      P.head(),
      transferNote(),
      App.ticket.render(opts),
      App.ticket.actions(opts)
    );
  }

  P.ticketView = ticketView;
})(window.App);
