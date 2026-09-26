const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

// A channel's contribution to luminance, from its sRGB byte, as WCAG 2 defines it
function toLinear(byte: string) {
  const channel = Number.parseInt(byte, 16) / 255

  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/*
  Whether white text reads better than black on a `#RRGGBB` background, which is what an
  organization's initials sit on. Compares the two contrast ratios WCAG 2 would give, which cross
  at a relative luminance of about 0.18: the brand's primary is dark, a yellow is not.

  Anything that is not six hex digits counts as dark, the default color being so
*/
function isDarkColor(hex: string) {
  const match = HEX_PATTERN.exec(hex)

  if (!match) return true

  const [, red, green, blue] = match
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)

  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
}

export default isDarkColor
