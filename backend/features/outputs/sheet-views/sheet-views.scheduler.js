/**
 * When the sheet views are rebuilt. A change only marks the form's views as
 * out of date and books one run a minute later. The run repaints every
 * marked form and removes itself, so students never wait for formatting and
 * nothing runs while nothing changes.
 */

var SheetViewsScheduler = (function () {
  /** How long after a change the run starts. */
  var VIEW_DELAY_MS_ = 60000;

  /**
   * How long a run starts new forms, well inside Google's six minutes; then
   * it books another.
   */
  var VIEW_RUN_BUDGET_MS_ = 240000;

  /** How long the note that a run is booked lasts, in seconds. */
  var BOOKED_NOTE_S_ = 300;

  /** The function the booked run calls. */
  var RUN_HANDLER_ = 'processDirtyViews';

  /**
   * Paints the views now, and gives the form's data tabs their look when
   * they lack it. It reads the responses and changes only its own tabs and
   * how cells look, so it takes no lock.
   *
   * @param {!Object} form The form.
   * @return {boolean} True when the form's type has views.
   */
  function rebuildViews(form) {
    var ss = SpreadsheetApp.openById(form.sheetId);
    SheetViewsLayout.styleFormTabs(ss);
    var build = SheetViewsBuilder.VIEW_BUILDERS[form.type];
    if (!build) return false;
    build(FormsPublic.validationForm(form), ss);
    return true;
  }

  /**
   * Marks a form's views as out of date, with the time, and makes sure a
   * run is booked.
   *
   * @param {!Object} form The form.
   */
  function refreshViews(form) {
    Properties.setProp(Constants.PROPS.DIRTY_PREFIX + form.id, Time.nowIso());
    bookViewRun_();
  }

  /**
   * Says whether a run is booked.
   *
   * @return {boolean} True when a trigger calls the run.
   */
  function viewRunBooked_() {
    return ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === RUN_HANDLER_;
    });
  }

  /**
   * Books one run of processDirtyViews. The cache note saves looking at the
   * triggers on every change.
   */
  function bookViewRun_() {
    var cache = CacheService.getScriptCache();
    if (cache.get(Constants.CACHE.VIEWS_BOOKED)) return;
    Lock.withLock(function () {
      if (viewRunBooked_()) return;
      ScriptApp.newTrigger(RUN_HANDLER_)
        .timeBased()
        .after(VIEW_DELAY_MS_)
        .create();
    });
    cache.put(Constants.CACHE.VIEWS_BOOKED, '1', BOOKED_NOTE_S_);
  }

  /** Removes the trigger of the run and the note that it is booked. */
  function unbookRun_() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === RUN_HANDLER_) ScriptApp.deleteTrigger(t);
    });
    CacheService.getScriptCache().remove(Constants.CACHE.VIEWS_BOOKED);
  }

  /**
   * Reads every form by its id.
   *
   * @return {!Object<string, !Object>} The forms.
   */
  function formsById_() {
    var forms = {};
    FormsRepository.readForms().forEach(function (f) {
      forms[f.id] = f;
    });
    return forms;
  }

  /**
   * Repaints a form's views, logging a failure.
   *
   * @param {!Object} form The form.
   * @return {boolean} True when it was repainted.
   */
  function tryRebuild_(form) {
    try {
      rebuildViews(form);
      return true;
    } catch (e) {
      Logger.log('Views of ' + form.slug + ' not rebuilt: ' + e.message);
      return false;
    }
  }

  /**
   * Handles one mark of the run: drops the mark of a form that is gone,
   * and repaints a marked form, dropping its mark unless a change came
   * meanwhile.
   *
   * @param {!Object} run The run: `store`, the `marks` it read, the
   *     `forms` by id and when it `started`.
   * @param {string} k The key of the mark.
   * @return {boolean} True when another run is needed.
   */
  function handleMark_(run, k) {
    var prefix = Constants.PROPS.DIRTY_PREFIX;
    if (k.indexOf(prefix) !== 0) return false;
    var form = run.forms[k.slice(prefix.length)];
    if (!form) {
      run.store.deleteProperty(k);
      return false;
    }
    if (Date.now() - run.started > VIEW_RUN_BUDGET_MS_) return true;
    if (!tryRebuild_(form)) return false;
    if (run.store.getProperty(k) !== run.marks[k]) return true;
    run.store.deleteProperty(k);
    return false;
  }

  /**
   * The booked run: removes its trigger, repaints every marked form, and
   * books another run only when a change arrived while it was painting or
   * it ran out of time. A form whose repaint fails keeps its mark, so the
   * next change, or Rebuild sheet in the dashboard, paints it.
   */
  function processDirtyViews() {
    unbookRun_();
    var store = PropertiesService.getScriptProperties();
    var run = {
      store: store,
      marks: store.getProperties(),
      forms: formsById_(),
      started: Date.now()
    };
    var again = false;
    Object.keys(run.marks).forEach(function (k) {
      again = handleMark_(run, k) || again;
    });
    if (again) bookViewRun_();
  }

  return { refreshViews, rebuildViews, processDirtyViews };
})();
