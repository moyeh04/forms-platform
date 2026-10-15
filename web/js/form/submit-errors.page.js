/**
 * What the student page does with each error the server gives back when a
 * registration is sent: the answers it refused, a registration that exists,
 * members of other teams, a slot that was taken, a form that closed.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  /** The state of the form behind each error of a form that closed. */
  var CLOSED_STATES = {
    form_closed: 'closed',
    form_not_yet: 'not_yet',
    form_draft: 'draft'
  };

  /**
   * Shows the answers the server refused, each on its own path.
   *
   * @param {!Object} d The errors, by question id.
   */
  function onInvalid(d) {
    var errs = {};
    Object.keys(d).forEach(function (id) {
      var x = d[id];
      if (!x?.nested) {
        errs[id] = x;
        return;
      }
      Object.keys(x.nested).forEach(function (k) {
        errs[id + '.' + k] = x.nested[k];
      });
    });
    P.showErrorsAndJump(errs);
  }

  /**
   * Makes the button that opens the key page.
   *
   * @return {!Element} The button.
   */
  function keyPageButton() {
    return h(
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
    );
  }

  /**
   * Shows that the student has a registration already, and offers the key
   * page.
   *
   * @param {!Object} d The details, with the `field` that clashed.
   */
  function onDuplicate(d) {
    var first = S.steps[0].fields[0] || {};
    var field = d.field || first.id;
    S.errors = {};
    S.errors[field] = { error: 'duplicate' };
    S.stepIndex = P.stepOfPath(field);
    S.banner = {
      kind: 'err',
      text: t('errors.duplicate'),
      action: keyPageButton()
    };
    P.render();
    P.focusFirstError();
  }

  /**
   * Goes back to the team step, where a team that has booked is shown its
   * booking.
   *
   * @return {!Promise<void>} Settles when the team is shown.
   */
  function onAlreadyBooked() {
    S.stepIndex = 0;
    S.banner = null;
    return P.findTeam();
  }

  /**
   * Writes the members that could be asked for, each with its team.
   *
   * @param {!Array<!Object>} offer The members, as `{code, team, leader}`.
   * @return {string} The question.
   */
  function offerText(offer) {
    var list = offer
      .map(function (o) {
        var leads = o.leader ? ' ' + t('transferLeads') : '';
        return P.who(P.memberName(o.code), o.code) + ' → ' + o.team + leads;
      })
      .join(t('listSep'));
    var leaders = offer.some(function (o) {
      return o.leader;
    });
    var body = t('transferBody', { list: list });
    return leaders ? body + ' ' + t('transferBodyLeader') : body;
  }

  /**
   * Offers to ask the other teams for every clashing member, before
   * refusing.
   *
   * @param {!Array<!Object>} offer The members that can be asked for.
   * @param {!Array<*>} codes Every clashing code.
   * @return {!Promise<boolean>} True when the student asked for them.
   */
  async function offerTransfer(offer, codes) {
    if (!offer.length || offer.length !== codes.length || S.transfer) {
      return false;
    }
    var ask = await App.ui.confirm({
      title: t('transferTitle'),
      body: offerText(offer),
      confirmText: t('transferAsk'),
      cancelText: t('transferNo')
    });
    if (!ask) return false;
    S.transfer = offer.map(function (o) {
      return o.code;
    });
    return true;
  }

  /**
   * Writes the members that were not offered although asking is on: each
   * leads a team with nobody to hand it to.
   *
   * @param {!Object} d The details of the error.
   * @param {!Array<!Object>} offer The members that can be asked for.
   * @param {!Array<*>} codes Every clashing code.
   * @return {string} The sentence, or ''.
   */
  function aloneText(d, offer, codes) {
    if (!d.transfer) return '';
    var alone = codes.filter(function (c) {
      return !offer.some(function (o) {
        return String(o.code) === String(c);
      });
    });
    if (!alone.length) return '';
    var list = alone
      .map(function (c) {
        return P.who(P.memberName(c), c);
      })
      .join(t('listSep'));
    return ' ' + t('transferAlone', { list: list });
  }

  /**
   * Refuses members that are on other teams, on the step of the members.
   *
   * @param {!Object} d The details of the error.
   * @param {!Array<!Object>} offer The members that can be asked for.
   * @param {!Array<*>} codes Every clashing code.
   */
  function refuseMembers(d, offer, codes) {
    var listed = d.codes ? ' (' + d.codes.join(', ') + ')' : '';
    S.transfer = null;
    S.banner = {
      kind: 'err',
      text: t('errors.duplicate_member') + listed + aloneText(d, offer, codes)
    };
    var step = S.steps.findIndex(function (s) {
      return s.fields.some(function (f) {
        return f.type === 'members';
      });
    });
    S.stepIndex = Math.max(0, step);
    P.render();
  }

  /**
   * Handles members that are on other teams: asks for them when every one
   * can be asked for, and refuses otherwise.
   *
   * @param {!Object} d The details of the error.
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function onDuplicateMember(d) {
    var offer = d.transfer || [];
    var codes = d.codes || [];
    if (await offerTransfer(offer, codes)) return P.submit();
    refuseMembers(d, offer, codes);
  }

  /**
   * Shows that the slot was taken meanwhile, with the slots read again and
   * the time cleared.
   *
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function onSlotTaken() {
    await P.refreshAvailability();
    var sf = P.slotField();
    var picked = (sf && S.data[sf.id]) || {};
    if (sf) {
      S.data[sf.id] = { day: picked.day, time: '' };
      S.errors = {};
      S.errors[sf.id] = { error: 'slot_taken' };
      S.stepIndex = P.stepOfPath(sf.id);
    }
    S.banner = { kind: 'err', text: t('errors.slot_taken') };
    P.render();
  }

  /**
   * Shows the page of a form that closed meanwhile.
   *
   * @param {string} code The error code.
   */
  function onClosed(code) {
    S.state = CLOSED_STATES[code];
    S.view = 'closed';
    P.render();
  }

  /**
   * Shows what an error of sending means and what the student can do.
   *
   * @param {!Error} e The error, with its `code` and `details`.
   * @return {!Promise<void>|undefined} Settles when the page is drawn.
   */
  function handleSubmitError(e) {
    var code = e.code;
    var d = e.details || {};
    if (code === 'invalid' && typeof d === 'object') return onInvalid(d);
    if (code === 'duplicate') return onDuplicate(d);
    if (code === 'already_booked') return onAlreadyBooked();
    if (code === 'duplicate_member') return onDuplicateMember(d);
    if (code === 'slot_taken') return onSlotTaken();
    if (CLOSED_STATES[code]) return onClosed(code);
    S.banner = {
      kind: 'err',
      text: App.i18n.err({ error: code }) || e.message
    };
    P.render();
  }

  P.handleSubmitError = handleSubmitError;
})(window.App);
