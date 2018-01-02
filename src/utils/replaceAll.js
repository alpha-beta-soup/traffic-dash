module.exports = (str, replaceMap) => {
  var re = new RegExp(`\\b(${Object.keys(replaceMap).join('|')})\\b`,'g')
  return str.replace(re, (matched) => {
    return replaceMap[matched]
  })
}
