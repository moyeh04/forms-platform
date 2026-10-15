/**
 * The steps of a form: which questions each step asks, its title, and the step
 * a question is on.
 */
(function (App) {
  'use strict';

  var P = App.formPage;
  var t = P.t;
  var L = P.L;
  var S = P.S;

  function buildSteps() {
    if (P.keyMode()) {
      var sf = P.slotField();
      var def = (S.form.steps || []).filter(function (s) {
        return s.fields.indexOf(sf.id) !== -1;
      })[0];
      S.steps = [
        { id: '_team', team: true, fields: [] },
        { id: 'slot', title: def ? def.title : sf.label, fields: [sf] },
        { id: '_review', review: true, fields: [] }
      ];
      return;
    }
    var fields = P.activeFields();
    var byId = {};
    fields.forEach(function (f) {
      byId[f.id] = f;
    });
    var defs =
      S.form.steps && S.form.steps.length
        ? S.form.steps
        : [
            {
              id: 'all',
              title: { en: 'Details', ar: 'البيانات' },
              fields: fields.map(function (f) {
                return f.id;
              })
            }
          ];
    var used = {};
    var steps = defs
      .map(function (s) {
        return {
          id: s.id,
          title: s.title,
          fields: s.fields
            .filter(function (id) {
              return byId[id];
            })
            .map(function (id) {
              used[id] = true;
              return byId[id];
            })
        };
      })
      .filter(function (s) {
        return s.fields.length;
      });
    var left = fields.filter(function (f) {
      return !used[f.id];
    });
    if (left.length) {
      if (!steps.length)
        steps.push({
          id: 'more',
          title: { en: 'Details', ar: 'البيانات' },
          fields: []
        });
      steps[steps.length - 1].fields =
        steps[steps.length - 1].fields.concat(left);
    }
    steps.push({ id: '_review', review: true, fields: [] });
    S.steps = steps;
  }

  function stepTitle(s) {
    return s.review ? t('reviewStep') : s.team ? t('teamStep') : L(s.title);
  }

  function stepOfPath(path) {
    var id = path.split('.')[0];
    for (var i = 0; i < S.steps.length; i++) {
      for (var j = 0; j < S.steps[i].fields.length; j++)
        if (S.steps[i].fields[j].id === id) return i;
    }
    return 0;
  }

  P.buildSteps = buildSteps;
  P.stepTitle = stepTitle;
  P.stepOfPath = stepOfPath;
})(window.App);
