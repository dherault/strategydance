/*
  Whether an address holds a space or a control character, C0, DEL or C1, which the URL parser
  strips silently, so `https://exa\nmple.com/cb` would pass as `https://example.com/cb` and be kept
  as written: an address is refused for one before it is parsed, so what is checked is what is
  stored and sent back
*/
function hasUriControlCharacters(uri: string) {
  for (const character of uri) {
    const code = character.codePointAt(0) ?? 0

    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  }

  return false
}

export default hasUriControlCharacters
