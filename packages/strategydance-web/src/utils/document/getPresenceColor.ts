/*
  The colors a writer's caret and ring are drawn in, from the design system's palette at a shade
  that carries white text: its primary, then Tailwind's at 600 or 700. Six-digit hex, which is what
  BlockNote reads to choose the label's text color
*/
const PRESENCE_COLORS = [
  '#0a61b5', // primary 600
  '#c2410c', // orange 700
  '#15803d', // green 700
  '#7e22ce', // purple 700
  '#be185d', // pink 700
  '#0e7490', // cyan 700
  '#a16207', // yellow 700
  '#4b6988', // secondary 500
]

// One person's color, the same on every tab and every document, picked by their uid
function getPresenceColor(userId: string) {
  let hash = 0

  for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) | 0

  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length]
}

export { PRESENCE_COLORS }

export default getPresenceColor
