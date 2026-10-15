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

  /** The digits of a registration key. */
  var KEY_DIGITS = Rules.editKeyDigits();

  /**
   * Says whether a text is a whole registration key.
   *
   * @param {string} key The text.
   * @return {boolean} True for five digits.
   */
  function isKey(key) {
    return Rules.isEditKey(key);
  }

  /**
   * Makes the box a registration key is typed in. It keeps digits only,
   * Arabic digits turned into Latin ones, and no more than a key has.
   *
   * @param {!Object} attrs Its id and other attributes.
   * @param {function(string)=} onType Gets the key after each change.
   * @return {!Element} The box.
   */
  function keyInput(attrs, onType) {
    var input = h(
      'input',
      Object.assign(
        {
          class: 'input key-input',
          type: 'text',
          inputmode: 'numeric',
          maxlength: String(KEY_DIGITS),
          placeholder: '0'.repeat(KEY_DIGITS)
        },
        attrs
      )
    );
    input.addEventListener('input', function () {
      input.value = Rules.latinDigits(input.value)
        .replace(/\D/g, '')
        .slice(0, KEY_DIGITS);
      if (onType) onType(input.value);
    });
    return input;
  }

  /**
   * Makes the buttons under the key: back to the form, and open.
   *
   * @return {!Element} The buttons.
   */
  function keyButtons() {
    return h(
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
    );
  }

  /**
   * Draws the page that asks for the key of a registration.
   *
   * @return {!Element} The sheet.
   */
  function keyEntryView() {
    var input = keyInput({
      id: 'key-input',
      autocomplete: 'one-time-code',
      'aria-label': t('keyLabel')
    });
    var error = h(
      'p',
      { class: 'error', role: 'alert', hidden: !S.keyError },
      S.keyError
    );
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
      keyButtons()
    );
    return P.sheet(
      P.head(),
      f,
      P.progressBlock(S.expiredProgress, t('progressNewKey'))
    );
  }

  /**
   * Takes in the registration a key opened.
   *
   * @param {string} key The key.
   * @param {!Object} res The answer of lookup.
   */
  function takeRegistration(key, res) {
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
    S.progress = res.progress || null;
    var sf = P.slotField();
    var slot = sf && S.data[sf.id];
    S.ownSlot = slot ? Rules.slotKey(slot.day, slot.time) : '';
    S.errors = {};
    S.banner = null;
    S.original = JSON.stringify(S.data);
    S.transfers = res.transfers || { incoming: [], outgoing: [] };
    P.buildSteps();
  }

  /**
   * Opens a registration with its key, on its summary, or on its time when
   * `toSlot` and the time can change.
   *
   * @param {*} typed The key.
   * @param {boolean=} toSlot True to open on the time.
   * @return {!Promise<void>} Settles when the page is drawn.
   */
  async function openByKey(typed, toSlot) {
    var key = String(typed || '').trim();
    if (!isKey(key)) {
      S.keyError = t('errors.bad_key');
      return P.render();
    }
    S.busy = true;
    S.expiredProgress = null;
    var res;
    try {
      res = await App.api.call({ action: 'lookup', slug: S.slug, key: key });
    } catch (e) {
      if (e.code === 'key_expired') await P.loadExpiredProgress(key);
      S.busy = false;
      S.keyError = App.i18n.err({ error: e.code }) || e.message;
      return P.render();
    }
    S.busy = false;
    takeRegistration(key, res);
    var sf = P.slotField();
    var onSlot = toSlot && res.canEdit && sf;
    S.stepIndex = onSlot ? P.stepOfPath(sf.id) : S.steps.length - 1;
    S.view = res.canEdit ? 'form' : 'readonly';
    P.render();
    P.askTransfers();
  }

  P.keyEntryView = keyEntryView;
  P.openByKey = openByKey;
  P.keyInput = keyInput;
  P.isKey = isKey;
})(window.App);
