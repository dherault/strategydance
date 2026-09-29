const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

// A channel's contribution to luminance, from its sRGB byte, as WCAG 2 defines it
function toLinear(byte: string) {
  const channel = Number.parseInt(byte, 16) / 255

  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function getLuminance(red: string, green: string, blue: string) {
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
}

// The near black that dark text is drawn in: Tailwind's neutral-950, oklch(14.5% 0 0), #0A0A0A
const NEAR_BLACK_LUMINANCE = getLuminance('0a', '0a', '0a')

/*
  Whether white text reads better than near black on a `#RRGGBB` background, such as the color a
  company's initials sit on. Compares the two contrast ratios WCAG 2 would give, which cross at a
  relative luminance of about 0.19: the brand's primary is dark, a yellow is not. Near black is
  compared as it is rather than as black, whose contrast it falls short of, or a mid gray would
  get the dark text when white reads better on it.

  Anything that is not six hex digits counts as dark, the primary being so
*/
function isDarkColor(hex: string) {
  const match = HEX_PATTERN.exec(hex)

  if (!match) return true

  const [, red, green, blue] = match
  const luminance = getLuminance(red, green, blue)

  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / (NEAR_BLACK_LUMINANCE + 0.05)
}

export { isDarkColor }
