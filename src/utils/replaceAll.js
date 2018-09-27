const replaceAll = (str, replaceMap) => {
  if (!str) return str;
  const re = new RegExp(`\\b(${Object.keys(replaceMap).join('|')})\\b`, 'g');
  return str.replace(re, matched => replaceMap[matched]);
};

if (module) {
  module.exports = replaceAll;
}
