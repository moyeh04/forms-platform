/** Reads a JSDoc comment into its summary and tags. */

/**
 * Splits the text after a tag into its `{type}` and the rest. The type may
 * hold nested braces, such as `{{file: string}}`.
 *
 * @param {string} text What follows the tag name.
 * @return {{type: (string|null), rest: string}} The type without its outer
 *     braces, or null when there is none, and the text after it.
 */
function splitType(text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{')) return { type: null, rest: trimmed };
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++;
    if (trimmed[i] === '}') depth--;
    if (depth === 0) {
      return { type: trimmed.slice(1, i), rest: trimmed.slice(i + 1).trim() };
    }
  }
  return { type: null, rest: trimmed };
}

/**
 * Turns the raw text of a block comment into lines without the leading `*`.
 *
 * @param {string} value The comment text between `/*` and `*\/`.
 * @return {!Array<string>} Its lines.
 */
function lines(value) {
  return value
    .replace(/^\*/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, '').trimEnd());
}

/**
 * Reads one tag line, with its continuation lines already joined to it.
 *
 * @param {string} text The tag and what follows it, such as
 *     `@param {string} name The name.`
 * @return {{tag: string, type: (string|null), name: string, text: string}}
 *     The parts of the tag.
 */
function readTag(text) {
  const [, tag, after] = /^@(\w+)\s*([\s\S]*)$/.exec(text);
  const { type, rest } = splitType(after);
  if (tag !== 'param') return { tag, type, name: '', text: rest };
  const [, name = '', said = ''] = /^(\S*)\s*([\s\S]*)$/.exec(rest);
  return { tag, type, name: name.replace(/^\[|\]$|=.*$/g, ''), text: said };
}

/**
 * Reads a JSDoc comment.
 *
 * @param {string} value The comment text between `/*` and `*\/`; it starts
 *     with `*` when the comment is JSDoc.
 * @return {{summary: string, tags: !Array<!Object>}} The text before the
 *     first tag, and every tag in order.
 */
function readDoc(value) {
  const summary = [];
  const tags = [];
  for (const line of lines(value)) {
    if (line.startsWith('@')) tags.push(line);
    else if (tags.length) tags[tags.length - 1] += ` ${line}`;
    else summary.push(line);
  }
  return { summary: summary.join(' ').trim(), tags: tags.map(readTag) };
}

module.exports = { readDoc };
