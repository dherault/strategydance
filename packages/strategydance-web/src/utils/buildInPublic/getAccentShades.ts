type Rgb = [number, number, number]

const HEX_PATTERN = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

const BLACK: Rgb = [0, 0, 0]
const WHITE: Rgb = [255, 255, 255]

// The light gray card's background, neutral-100, and the navy card's panel, secondary-800
const NEUTRAL_100: Rgb = [245, 245, 245]
const SECONDARY_800: Rgb = [0x20, 0x35, 0x4c]

// What a mark has to reach against what it sits on, a little over WCAG's 4.5:1 for text, since
// the backgrounds are mixed in oklch on the card and approximated in sRGB here
const MIN_CONTRAST = 4.6

// How many steps a color takes on its way to black or white, each 4% of the way
const STEPS = 25

function toRgb(hex: string): Rgb | null {
  const match = HEX_PATTERN.exec(hex)

  return match ? [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)] : null
}

function toHex(rgb: Rgb) {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

function mix(from: Rgb, to: Rgb, ratio: number): Rgb {
  return from.map((channel, index) => Math.round(channel * (1 - ratio) + to[index] * ratio)) as Rgb
}

// A channel's contribution to luminance, from its sRGB byte, as WCAG 2 defines it
function toLinear(channel: number) {
  const value = channel / 255

  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function getLuminance([red, green, blue]: Rgb) {
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
}

function getContrast(first: Rgb, second: Rgb) {
  const [lighter, darker] = [getLuminance(first), getLuminance(second)].sort((a, b) => b - a)

  return (lighter + 0.05) / (darker + 0.05)
}

// The color moved toward black or white until it reads on every background, unchanged when it
// already does
function reach(color: Rgb, toward: Rgb, backgrounds: Rgb[]) {
  for (let step = 0; step <= STEPS; step++) {
    const shade = mix(color, toward, step / STEPS)

    if (backgrounds.every(background => getContrast(shade, background) >= MIN_CONTRAST)) return toHex(shade)
  }

  return toHex(toward)
}

/*
  The accent as a build in public card marks things with it, readable whatever the accent: `ink`
  on the light tones, darkened until it reads on the tinted card's panel, the darkest light
  background it sits on, and on light gray; `high` on navy, its light shade lightened until it
  reads on the navy card's panel. A dark accent comes back as it is, a yellow much darker.

  Anything that is not six hex digits comes back unchanged, as `isDarkColor` takes it for dark
*/
function getAccentShades(accent: string) {
  const rgb = toRgb(accent)

  if (!rgb) return { ink: accent, high: accent }

  return {
    ink: reach(rgb, BLACK, [mix(rgb, WHITE, 0.84), NEUTRAL_100]),
    high: reach(mix(rgb, WHITE, 0.5), WHITE, [SECONDARY_800]),
  }
}

export { getContrast, toRgb }

export default getAccentShades
