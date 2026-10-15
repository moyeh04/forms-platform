/**
 * Opening a registration with its key: the page that asks for the key, and
 * loading the registration on its summary or on its time.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var h = App.ui.h;
  var t = P.t;
  var S = P.S;

  function keyEntryView() {
    var input = h('input', {
      class: 'input key-input',
      id: 'key-input',
      type: 'text',
      inputmode: 'numeric',
      maxlength: '5',
      autocomplete: 'one-time-code',
      'aria-label': t('keyLabel'),
      placeholder: '00000'
    });
    var error = h(
      'p',
      { class: 'error', role: 'alert', hidden: !S.keyError },
      S.keyError
    );
    input.addEventListener('input', function () {
      input.value = Rules.latinDigits(input.value)
        .replace(/\D/g, '')
        .slice(0, 5);
    });
    var f = h(
      'form',
      {
        novalidate: 'novalidate',
        onsubmit: function (e) {
          e.preventDefault();
          openByKey(input.value);
        }
      },
      h('h2', { class: 'step-title' }, t('editTitle')),
      h('p', { class: 'step-help' }, t('editHelp')),
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'label', for: 'key-input' }, t('keyLabel')),
        input,
        error
      ),
      h(
        'div',
        { class: 'nav' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-quiet',
            onclick: function () {
              S.view = S.state === 'open' ? 'form' : 'closed';
              P.render();
            }
          },
          t('backToForm')
        ),
        h(
          'button',
          { type: 'submit', class: 'btn btn-primary', disabled: S.busy },
          t('editOpen')
        )
      )
    );
    return P.sheet(P.head(), f);
  }

  /** Opens a registration with its key, on its summary, or on its time when `toSlot` and the time can change. */
  async function openByKey(key, toSlot) {
    key = String(key || '').trim();
    if (!/^\d{5}$/.test(key)) {
      S.keyError = t('errors.bad_key');
      return P.render();
    }
    S.busy = true;
    try {
      var res = await App.api.call({
        action: 'lookup',
        slug: S.slug,
        key: key
      });
      S.busy = false;
      S.mode = 'edit';
      S.key = key;
      S.keyInfo = {
        ref: res.submission.ref,
        keyExpires: res.keyExpires,
        canEdit: res.canEdit,
        slotOnly: !!res.slotOnly,
        canDelete: res.canDelete,
        locked: !!res.locked
      };
      S.data = res.submission.data || {};
      var sf = P.slotField();
      S.ownSlot =
        sf && S.data[sf.id]
          ? Rules.slotKey(S.data[sf.id].day, S.data[sf.id].time)
          : '';
      S.errors = {};
      S.banner = null;
      S.original = JSON.stringify(S.data);
      S.transfers = res.transfers || { incoming: [], outgoing: [] };
      P.buildSteps();
      S.stepIndex =
        toSlot && res.canEdit && sf ? P.stepOfPath(sf.id) : S.steps.length - 1;
      S.view = res.canEdit ? 'form' : 'readonly';
      P.render();
      P.askTransfers();
    } catch (e) {
      S.busy = false;
      S.keyError = App.i18n.err({ error: e.code }) || e.message;
      P.render();
    }
  }

  P.keyEntryView = keyEntryView;
  P.openByKey = openByKey;
})(window.App);
