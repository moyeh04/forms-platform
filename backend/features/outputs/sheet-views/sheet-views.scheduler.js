/**
 * When the sheet views are rebuilt. A change only marks the form's views as out
 * of date and books one run a minute later. The run repaints every marked form
 * and removes itself, so students never wait for formatting and nothing runs
 * while nothing changes.
 */

var VIEW_DELAY_MS_ = 60000;

/** A run stops starting new forms after this long, well inside Google's six minutes, and books another. */
var VIEW_RUN_BUDGET_MS_ = 240000;

/**
 * Paints the views now, and gives the form's data tabs their look when they lack it. It reads
 * the responses and changes only its own tabs and how cells look, so it takes no lock.
 */
function rebuildViews(form) {
  var ss = SpreadsheetApp.openById(form.sheetId);
  SheetStyle.styleFormTabs(ss);
  var build = VIEW_BUILDERS_[form.type];
  if (!build) return false;
  build(FormsPublic.validationForm(form), ss);
  return true;
}

/** Marks a form's views as out of date, with the time, and makes sure a run is booked. */
function refreshViews(form) {
  Properties.setProp('dirty:' + form.id, Time.nowIso());
  bookViewRun_();
}

function viewRunBooked_() {
  return ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'processDirtyViews';
  });
}

/** Books one run of processDirtyViews. The cache note saves looking at the triggers on every change. */
function bookViewRun_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('views_booked')) return;
  Lock.withLock(function () {
    if (!viewRunBooked_())
      ScriptApp.newTrigger('processDirtyViews')
        .timeBased()
        .after(VIEW_DELAY_MS_)
        .create();
  });
  cache.put('views_booked', '1', 300);
}

/**
 * The booked run: removes its trigger, repaints every marked form, and books another run only
 * when a change arrived while it was painting or it ran out of time. A form whose repaint fails
 * keeps its mark, so the next change, or Rebuild sheet in the dashboard, paints it.
 */
function processDirtyViews() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processDirtyViews')
      ScriptApp.deleteTrigger(t);
  });
  CacheService.getScriptCache().remove('views_booked');
  var store = PropertiesService.getScriptProperties();
  var marks = store.getProperties();
  var forms = {};
  FormsRepository.readForms().forEach(function (f) {
    forms[f.id] = f;
  });
  var started = Date.now(),
    again = false;
  Object.keys(marks).forEach(function (k) {
    if (k.indexOf('dirty:') !== 0) return;
    var form = forms[k.slice(6)];
    if (!form) {
      store.deleteProperty(k);
      return;
    }
    if (Date.now() - started > VIEW_RUN_BUDGET_MS_) {
      again = true;
      return;
    }
    try {
      rebuildViews(form);
    } catch (e) {
      Logger.log('Views of ' + form.slug + ' not rebuilt: ' + e.message);
      return;
    }
    if (store.getProperty(k) === marks[k]) store.deleteProperty(k);
    else again = true;
  });
  if (again) bookViewRun_();
}
