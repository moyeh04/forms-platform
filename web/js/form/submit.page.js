/**
 * Sending the registration, and what the page does with each error the server
 * gives back.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  async function submit() {
    if (P.keyMode() && !S.team) return P.go(0);
    var v = P.validateAll();
    if (!v.ok) return P.showErrorsAndJump(v.errors);
    S.busy = true;
    S.banner = null;
    P.render();
    try {
      var res;
      if (S.mode === 'edit') {
        res = await App.api.call({
          action: 'update',
          slug: S.slug,
          key: S.key,
          data: v.data,
          transfer: S.transfer || undefined
        });
        S.result = { ref: res.ref, edited: true };
      } else {
        var request = {
          action: 'submit',
          slug: S.slug,
          data: v.data,
          lang: App.i18n.lang,
          transfer: S.transfer || undefined
        };
        if (P.keyMode()) request.sourceKey = S.sourceKey;
        res = await App.api.call(request);
        S.result = {
          ref: res.ref,
          key: res.key,
          keyExpires: res.keyExpires,
          emailed: !!res.emailed
        };
      }
      // A member that was asked for from another team is not in the saved answers yet.
      S.data = res.data || v.data;
      S.result.transfers = res.transfers || [];
      S.transfer = null;
      P.clearDraft();
      S.busy = false;
      S.view = 'ticket';
      P.render();
      try {
        window.scrollTo(0, 0);
      } catch (e) {
        /* not available */
      }
    } catch (e) {
      S.busy = false;
      await handleSubmitError(e);
    }
  }

  async function handleSubmitError(e) {
    var code = e.code;
    var d = e.details || {};
    if (code === 'invalid' && d && typeof d === 'object') {
      var errs = {};
      Object.keys(d).forEach(function (id) {
        var x = d[id];
        if (x && x.nested)
          Object.keys(x.nested).forEach(function (k) {
            errs[id + '.' + k] = x.nested[k];
          });
        else errs[id] = x;
      });
      return P.showErrorsAndJump(errs);
    }
    if (code === 'duplicate') {
      var field = d.field || (S.steps[0].fields[0] || {}).id;
      S.errors = {};
      S.errors[field] = { error: 'duplicate' };
      S.stepIndex = P.stepOfPath(field);
      S.banner = {
        kind: 'err',
        text: t('errors.duplicate'),
        action: h(
          'button',
          {
            type: 'button',
            class: 'link-btn',
            onclick: function () {
              S.view = 'keyEntry';
              S.keyError = '';
              S.banner = null;
              P.render();
            }
          },
          t('editLink')
        )
      };
      P.render();
      P.focusFirstError();
      return;
    }
    if (code === 'already_booked') {
      S.stepIndex = 0;
      S.banner = null;
      return P.findTeam();
    }
    if (code === 'duplicate_member') {
      // Every clashing member can be asked for: offer that before refusing.
      var offer = d.transfer || [],
        codes = d.codes || [];
      if (offer.length && offer.length === codes.length && !S.transfer) {
        var list = offer
          .map(function (o) {
            return (
              P.who(P.memberName(o.code), o.code) +
              ' → ' +
              o.team +
              (o.leader ? ' ' + t('transferLeads') : '')
            );
          })
          .join(t('listSep'));
        var body =
          t('transferBody', { list: list }) +
          (offer.some(function (o) {
            return o.leader;
          })
            ? ' ' + t('transferBodyLeader')
            : '');
        var ask = await App.ui.confirm({
          title: t('transferTitle'),
          body: body,
          confirmText: t('transferAsk'),
          cancelText: t('transferNo')
        });
        if (ask) {
          S.transfer = offer.map(function (o) {
            return o.code;
          });
          return submit();
        }
      }
      // Asking is on, yet these were not offered: each leads a team with nobody to hand it to.
      var alone = d.transfer
        ? codes.filter(function (c) {
            return !offer.some(function (o) {
              return String(o.code) === String(c);
            });
          })
        : [];
      S.transfer = null;
      S.banner = {
        kind: 'err',
        text:
          t('errors.duplicate_member') +
          (d.codes ? ' (' + d.codes.join(', ') + ')' : '') +
          (alone.length
            ? ' ' +
              t('transferAlone', {
                list: alone
                  .map(function (c) {
                    return P.who(P.memberName(c), c);
                  })
                  .join(t('listSep'))
              })
            : '')
      };
      S.stepIndex = Math.max(
        0,
        S.steps.findIndex(function (s) {
          return s.fields.some(function (f) {
            return f.type === 'members';
          });
        })
      );
      return P.render();
    }
    if (code === 'slot_taken') {
      await P.refreshAvailability();
      var sf = P.slotField();
      if (sf) {
        S.data[sf.id] = { day: (S.data[sf.id] || {}).day, time: '' };
        S.errors = {};
        S.errors[sf.id] = { error: 'slot_taken' };
        S.stepIndex = P.stepOfPath(sf.id);
      }
      S.banner = { kind: 'err', text: t('errors.slot_taken') };
      return P.render();
    }
    if (
      code === 'form_closed' ||
      code === 'form_not_yet' ||
      code === 'form_draft'
    ) {
      S.state = {
        form_closed: 'closed',
        form_not_yet: 'not_yet',
        form_draft: 'draft'
      }[code];
      S.view = 'closed';
      return P.render();
    }
    S.banner = {
      kind: 'err',
      text: App.i18n.err({ error: code }) || e.message
    };
    P.render();
  }

  P.submit = submit;
})(window.App);
