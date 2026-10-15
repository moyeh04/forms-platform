/**
 * Checks that every colour of the stylesheets has a name. A colour written
 * out (a hex value, a colour function such as rgba(), or a colour keyword
 * such as white) is allowed only in the palette file `colours.palette`, and
 * there only as the value of a custom property. Every other declaration uses
 * the name, `var(--name)`. `transparent` and `currentColor` are no colours of
 * their own, so they pass.
 */
const { select, read } = require('../lib/files.js');

const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const WORD = /(?<![\w-])[a-z]+(?![\w-])/gi;

/** The colour keywords of CSS Color 4. */
const NAMED = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black
  blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
  chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
  darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
  darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
  forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
  greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
  lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
  lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
  lightsteelblue lightyellow lime limegreen linen magenta maroon
  mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
  mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
  midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive
  olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise
  palevioletred papayawhip peachpuff peru pink plum powderblue purple
  rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown
  seagreen seashell sienna silver skyblue slateblue slategray slategrey
  snow springgreen steelblue tan teal thistle tomato turquoise violet
  wheat white whitesmoke yellow yellowgreen`.split(/\s+/)
);

/**
 * Blanks out what can hold colour-like text that is no colour: comments,
 * strings and url() addresses. Line breaks stay, so offsets keep their line.
 *
 * @param {string} source The stylesheet.
 * @return {string} The same text with those parts turned into spaces.
 */
function blankQuoted(source) {
  return source.replace(
    /\/\*[\s\S]*?\*\/|"[^"]*"|'[^']*'|url\([^)]*\)/g,
    (part) => part.replace(/[^\n]/g, ' ')
  );
}

/**
 * Lists the declarations of a stylesheet: each piece of text between braces
 * and semicolons that is not followed by an opening brace.
 *
 * @param {string} text The stylesheet, with comments and strings blanked.
 * @return {!Array<{property: string, value: string, at: number}>} Each
 *     declaration, with the offset where its value starts.
 */
function declarations(text) {
  const out = [];
  for (const piece of text.matchAll(/[^{};]+(?=[{};]|$)/g)) {
    const end = piece.index + piece[0].length;
    const colon = piece[0].indexOf(':');
    if (text[end] === '{' || colon === -1) continue;
    out.push({
      property: piece[0].slice(0, colon).trim(),
      value: piece[0].slice(colon + 1),
      at: piece.index + colon + 1
    });
  }
  return out;
}

/**
 * Finds the colours written out in a value.
 *
 * @param {string} value The value of a declaration.
 * @return {!Array<{text: string, index: number}>} Each colour and where it
 *     starts in the value.
 */
function coloursIn(value) {
  const words = [...value.matchAll(WORD)].filter((m) =>
    NAMED.has(m[0].toLowerCase())
  );
  return [...value.matchAll(HEX), ...value.matchAll(FUNCTION), ...words].map(
    (m) => ({ text: m[0].replace(/\($/, '()'), index: m.index })
  );
}

/**
 * Checks the colours of one stylesheet.
 *
 * @param {string} file The path of the file.
 * @param {string} source Its text.
 * @param {string} palette The path of the one file that names colours.
 * @return {!Array<!Object>} One finding for each colour written out.
 */
function checkSource(file, source, palette) {
  const text = blankQuoted(source);
  const out = [];
  for (const { property, value, at } of declarations(text)) {
    if (file === palette && property.startsWith('--')) continue;
    for (const colour of coloursIn(value)) {
      const before = text.slice(0, at + colour.index);
      out.push({
        file,
        line: before.split('\n').length,
        rule: 'colours',
        message:
          `${colour.text} is a colour without a name; name it in ` +
          `${palette} and use var(--name)`
      });
    }
  }
  return out;
}

/**
 * Checks the colours of the stylesheets of a run.
 *
 * @param {string} root The repository root.
 * @param {!Array<string>} files The files of the run.
 * @param {!Object} config The checks configuration.
 * @return {!Array<!Object>} One finding for each colour written out.
 */
function check(root, files, config) {
  return select(files, config.colours).flatMap((file) =>
    checkSource(file, read(root, file), config.colours.palette)
  );
}

module.exports = { check, checkSource };
