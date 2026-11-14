// Stylelint checks the CSS for mistakes and holds the token and right-to-left rules; Oxfmt owns
// the layout.
const PHYSICAL = [
  "margin-left",
  "margin-right",
  "padding-left",
  "padding-right",
  "left",
  "right",
  "/^border-(left|right)/",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "scroll-margin-left",
  "scroll-margin-right",
  "scroll-padding-left",
  "scroll-padding-right",
];

/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-declaration-strict-value"],
  rules: {
    // Off: blank lines are layout, which the formatter owns.
    "at-rule-empty-line-before": null,
    "comment-empty-line-before": null,
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "rule-empty-line-before": null,
    // Safari on iOS reads only -webkit-text-size-adjust, and Chrome before 120 and Safari before
    // 15.4 read only -webkit-mask; the pages serve older phones.
    "property-no-vendor-prefix": [
      true,
      { ignoreProperties: ["-webkit-mask", "-webkit-text-size-adjust"] },
    ],
    // Range media queries (width >= 40rem) need Chrome 104 and Safari 16.4, and a list inside
    // :not() needs Chrome 88; an older phone would drop the whole rule.
    "media-feature-range-notation": "prefix",
    "selector-not-notation": "simple",
    // Off: it compares selectors that never match the same element (.admin-nav a and
    // .form-tabs a), and reordering to please it would pull rules away from their part.
    "no-descending-specificity": null,
    // Kebab case, with a status value from the data kept as written (is-not_yet, in_review) and
    // a numbered modifier (t-stagger-line--2).
    "selector-class-pattern": "^[a-z][a-z0-9]*(?:(?:-{1,2}|_)[a-z0-9]+)*$",
    // Font names keep the capitals their foundries give them.
    "value-keyword-case": ["lower", { ignoreProperties: ["/^--font-/", "font-family"] }],
    // A page takes its colours from the tokens of theme.css. Font sizes are left out: the type
    // tokens name roles, and the 88 sizes set in the pages do not map onto them.
    "scale-unlimited/declaration-strict-value": [
      ["/color$/", "fill", "stroke"],
      {
        ignoreValues: ["currentcolor", "transparent", "inherit"],
        expandShorthand: true,
        message: "Take the value from a token of web/css/theme.css: var(--…)",
      },
    ],
    // Every page also runs right to left in Arabic, so sides are logical: margin-inline-start,
    // inset-inline-end, border-inline-start, text-align: start.
    "property-disallowed-list": [
      PHYSICAL,
      {
        message: (property) =>
          `"${property}" is physical; use its logical form (inline-start or inline-end)`,
      },
    ],
    "declaration-property-value-disallowed-list": [
      { "text-align": ["left", "right"], float: ["left", "right"], clear: ["left", "right"] },
      { message: "Use start or end (inline-start, inline-end), which follow the page's direction" },
    ],
  },
  overrides: [
    {
      // The ticket and the island trail place their parts on a picture, measured from its left
      // edge; the picture does not mirror in Arabic, so neither do they.
      files: ["web/css/app/ticket.css", "web/css/app/route.css"],
      rules: { "property-disallowed-list": null },
    },
    {
      // The tokens hold the raw values.
      files: ["web/css/theme.css"],
      rules: { "scale-unlimited/declaration-strict-value": null },
    },
  ],
};
