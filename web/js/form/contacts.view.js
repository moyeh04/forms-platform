/**
 * The names and contacts of other teams, for the requests to move a member: who
 * is asked, and how to reach the other leader.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var icon = App.ui.icon;
  var t = P.t;
  var S = P.S;

  /** The size of the icons in a contact line, in pixels. */
  var CONTACT_ICON_SIZE = 18;

  /**
   * Writes a student as their name and code.
   *
   * @param {string} name The name, or ''.
   * @param {*} code The student code.
   * @return {string} "Name (code)", or the code alone.
   */
  function who(name, code) {
    return name ? name + ' (' + code + ')' : String(code);
  }

  /**
   * Finds the name of a member of this team.
   *
   * @param {*} code The student code.
   * @return {string} The name, or ''.
   */
  function memberName(code) {
    var mf = Rules.fieldByRole(S.form, 'members');
    var members = (mf && S.data[mf.id]) || [];
    var hit = members.filter(function (m) {
      return String(m.code) === String(code);
    })[0];
    return hit ? hit.name : '';
  }

  /**
   * Draws a phone number, as a WhatsApp link when the form says so.
   *
   * @param {!Object} r The request, with `phone` and `whatsapp`.
   * @return {!Element} The number.
   */
  function phoneNumber(r) {
    var link = r.whatsapp ? Rules.whatsappLink(r.phone) : '';
    if (!link) return h('span', { class: 'mono', dir: 'ltr' }, r.phone);
    return h(
      'a',
      {
        class: 'mono',
        href: link,
        target: '_blank',
        rel: 'noopener',
        dir: 'ltr',
        title: t('openWhatsapp')
      },
      icon('chat', CONTACT_ICON_SIZE),
      r.phone
    );
  }

  /**
   * Draws how to reach the leader of the other team of a request, when the
   * form shows it: the number and a button that copies it.
   *
   * @param {!Object} r The request.
   * @return {?Element} The line, or null without a number.
   */
  function leaderContact(r) {
    if (!r.phone) return null;
    return h(
      'p',
      { class: 'leader-contact', dataset: { team: r.team } },
      h('span', null, t('transferLeaderPhone', { team: r.team })),
      phoneNumber(r),
      h(
        'button',
        {
          type: 'button',
          class: 'link-btn',
          name: 'copy-phone',
          onclick: async function () {
            var ok = await App.ui.copyText(r.phone);
            App.ui.toast(t(ok ? 'copied' : 'copyFail'), ok ? 'ok' : 'err');
          }
        },
        icon('copy', CONTACT_ICON_SIZE),
        t('copyNumber')
      )
    );
  }

  /**
   * Draws one line for each other team of a list of requests, however many
   * of its students were asked for.
   *
   * @param {!Array<!Object>} list The requests.
   * @return {!Array<?Element>} The lines.
   */
  function leaderContacts(list) {
    var seen = {};
    return list
      .filter(function (r) {
        if (!r.phone || seen[r.team]) return false;
        seen[r.team] = true;
        return true;
      })
      .map(leaderContact);
  }

  /**
   * Writes what a request asks: for a member of this team, or for the
   * leader who reads it.
   *
   * @param {!Object} r The request.
   * @return {string} The sentence.
   */
  function askedText(r) {
    return r.leader
      ? t('transferAskedYou', { team: r.team })
      : t('transferAskedBody', { team: r.team, who: who(r.name, r.code) });
  }

  P.who = who;
  P.memberName = memberName;
  P.leaderContacts = leaderContacts;
  P.askedText = askedText;
  P.leaderContact = leaderContact;
})(window.App);
