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

  /** The day and time of a booking, for the picture on its ticket. */
  function bookedWhen() {
    var sf = P.slotField(),
      v = sf && S.data[sf.id];
    var day =
      v &&
      ((S.form.slots && S.form.slots.days) || []).filter(function (d) {
        return d.id === v.day;
      })[0];
    return day && v.time ? { day: day, time: v.time } : null;
  }

  function ticketView() {
    var em = Rules.valueByRole(S.form, S.data, 'email');
    // A booking made with a team's key answers to that key, which the team has already; a new key is shown.
    var key =
      S.form.keyBooking && S.result.key === S.sourceKey ? '' : S.result.key;
    var opts = {
      ref: S.result.ref,
      key: key,
      keyExpires: S.result.keyExpires,
      edited: !!S.result.edited,
      when: bookedWhen(),
      teamKey: !!S.form.keyBooking && !key && !S.result.edited,
      email: !S.result.edited && S.result.emailed ? em : '',
      summary: P.ticketSummary()
    };
    var asked = S.result.transfers || [];
    var note = asked.length
      ? h(
          'div',
          { class: 'banner info', role: 'status', name: 'transfer-sent' },
          t('transferSent', {
            list: asked
              .map(function (a) {
                return P.who(a.name, a.code) + ' → ' + a.team;
              })
              .join(t('listSep'))
          }),
          P.leaderContacts(asked)
        )
      : null;
    return P.sheet(
      P.head(),
      note,
      App.ticket.render(opts),
      App.ticket.actions(opts)
    );
  }

  P.ticketView = ticketView;
})(window.App);
