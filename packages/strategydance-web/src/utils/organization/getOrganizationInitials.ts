/*
  What an organization's mark reads without a logo: the first letter of its first two words,
  uppercased, so "Strategy Dance" is "SD" and "Acme" is "A". Letters are read as characters
  rather than UTF-16 units, so a name starting with an emoji or a supplementary ideograph keeps it
  whole. Empty for a name with nothing in it
*/
function getOrganizationInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => Array.from(word)[0] ?? '')
    .join('')
    .toUpperCase()
}

export default getOrganizationInitials
