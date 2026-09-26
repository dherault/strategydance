const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/*
  What an organization's mark reads without a logo: the first letter of its first two words,
  uppercased, so "Strategy Dance" is "SD" and "Acme" is "A". Letters are read as graphemes, what
  a reader sees as one character, rather than as code points or UTF-16 units, so a name starting
  with a flag, a family emoji or a letter carrying a combining accent keeps it whole. Empty for a
  name with nothing in it
*/
function getOrganizationInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => graphemeSegmenter.segment(word).containing(0)?.segment ?? '')
    .join('')
    .toUpperCase()
}

export default getOrganizationInitials
