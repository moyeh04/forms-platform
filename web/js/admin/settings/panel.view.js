/**
 * A section of the settings page folded to one line: its name and what it
 * is set to now. A click on the line unfolds it.
 */
(function (App) {
  'use strict';

  var A = App.admin;
  var h = App.ui.h;

  /**
   * Draws a folded section.
   *
   * @param {string} title Its name.
   * @param {*} help The help under the name, or null.
   * @param {...*} body What it holds.
   * @return {!Element} The section. `summary` is a function, set by the
   *     caller, that returns the folded line; `setOpen(open)` unfolds it;
   *     `paintSummary()` draws the line again; `pin()` keeps it open;
   *     `onToggle(open)`, when set, is told each fold.
   */
  A.panel = function (title, help, ...body) {
    var content = h(
      'div',
      { class: 'panel-body', hidden: true },
      help ? h('p', { class: 'help' }, help) : null,
      body
    );
    var sum = h('span', { class: 'panel-sum' });
    var head = h(
      'button',
      { type: 'button', class: 'panel-head', 'aria-expanded': 'false' },
      h('span', { class: 'panel-title' }, title),
      sum
    );
    var node = h(
      'section',
      { class: 'panel fold', dataset: { panel: title } },
      h('h2', null, head),
      content
    );
    node.panelTitle = title;

    /**
     * Tells whether the section is unfolded.
     *
     * @return {boolean} True when it is.
     */
    function isOpen() {
      return !content.hidden;
    }

    /**
     * Folds or unfolds the section.
     *
     * @param {boolean} open True to unfold it.
     */
    function setOpen(open) {
      content.hidden = !open;
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      node.classList.toggle('open', !!open);
      if (node.onToggle) node.onToggle(!!open);
    }

    /** Draws the folded line again. */
    function paintSummary() {
      sum.textContent = node.summary ? node.summary() : '';
    }

    /** Keeps the section open: a work area has nothing to fold to. */
    function pin() {
      node.pinned = true;
      node.classList.add('pinned');
      head.disabled = true;
      setOpen(true);
    }

    node.isOpen = isOpen;
    node.setOpen = setOpen;
    node.paintSummary = paintSummary;
    node.pin = pin;
    head.addEventListener('click', function () {
      node.setOpen(content.hidden);
    });
    return node;
  };
})(window.App);
