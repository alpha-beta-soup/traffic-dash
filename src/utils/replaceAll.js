// Replaces whole words using replaceMap. A replacement can be a function of the text before
// the word, returning the replacement or null to leave the word as it is.
export default function replaceAll(str, replaceMap) {
  if (!str) return str;
  const re = new RegExp(`\\b(${Object.keys(replaceMap).join('|')})\\b`, 'g');
  return str.replace(re, (matched, word, offset) => {
    const replacement = replaceMap[matched];
    return typeof replacement === 'function' ? replacement(str.slice(0, offset)) ?? matched : replacement;
  });
}
