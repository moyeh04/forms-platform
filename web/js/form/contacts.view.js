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

  function who(name, code) {
    return name ? name + ' (' + code + ')' : String(code);
  }

  function memberName(code) {
    var mf = Rules.fieldByRole(S.form, 'members');
    var hit = ((mf && S.data[mf.id]) || []).filter(function (m) {
      return String(m.code) === String(code);
    })[0];
    return hit ? hit.name : '';
  }

  /**
   * How to reach the leader of the other team of a request, when the form shows it: the number,
   * as a WhatsApp link when the form says so, and a button that copies it. Null otherwise.
   */
  function leaderContact(r) {
    if (!r.phone) return null;
    var link = r.whatsapp ? Rules.whatsappLink(r.phone) : '';
    return h(
      'p',
      { class: 'leader-contact', dataset: { team: r.team } },
      h('span', null, t('transferLeaderPhone', { team: r.team })),
      link
        ? h(
            'a',
            {
              class: 'mono',
              href: link,
              target: '_blank',
              rel: 'noopener',
              dir: 'ltr',
              title: t('openWhatsapp')
            },
            icon('chat', 18),
            r.phone
          )
        : h('span', { class: 'mono', dir: 'ltr' }, r.phone),
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
        icon('copy', 18),
        t('copyNumber')
      )
    );
  }

  /** One line for each other team of `list`, however many of its students were asked for. */
  function leaderContacts(list) {
    var seen = {};
    return list
      .filter(function (r) {
        return r.phone && !seen[r.team] && (seen[r.team] = true);
      })
      .map(leaderContact);
  }

  /** What a request asks: for a member of this team, or for the leader who reads it. */
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
