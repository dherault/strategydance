import type { CSSProperties } from 'react'
import { isDarkColor } from 'strategydance-design-system/lib/isDarkColor'

import type { CardInk, CardTone, FlameColor } from '~types'

import { CARD_INK_COLORS } from '~constants'

import getAccentShades from '~utils/buildInPublic/getAccentShades'

type Variables = Record<`--${string}`, string>

/*
  The accent, whatever the card is drawn on, with what reads on it, three lighter shades of it, what
  darkens or lightens it into a panel, and the shades it marks things in where it would not read
  as it is: `ink` on the light tones and `high` on navy (`getAccentShades`)
*/
function getAccentVariables(accent: string): Variables {
  const isDark = isDarkColor(accent)
  const { ink, high } = getAccentShades(accent)

  return {
    '--card-accent': accent,
    '--card-on-accent': isDark ? '#ffffff' : '#000000',
    '--card-accent-shade': isDark ? 'black' : 'white',
    '--card-accent-50': `color-mix(in oklch, ${accent} 8%, white)`,
    '--card-accent-100': `color-mix(in oklch, ${accent} 16%, white)`,
    '--card-accent-light': `color-mix(in oklch, ${accent} 50%, white)`,
    '--card-accent-ink': ink,
    '--card-accent-high': high,
  }
}

/*
  On the three light tones the accent's ink marks things, and a white or tinted panel sets one part
  apart. A day lit in a calendar needs no outline, its flame's background showing on the card
*/
const LIGHT_TONE: Variables = {
  '--card-foreground': 'var(--color-secondary-900)',
  '--card-mark': 'var(--card-accent-ink)',
  '--card-strong': 'var(--card-accent-ink)',
  '--card-panel': 'var(--card-accent-50)',
  '--card-track': 'var(--card-accent-100)',
  '--card-eyebrow': 'var(--card-accent-ink)',
  '--card-muted': 'var(--color-neutral-600)',
  '--card-url': 'var(--color-neutral-600)',
  '--card-square': 'var(--color-neutral-100)',
  '--card-cell-ring': 'none',
  '--card-box': '#ffffff',
  '--card-box-border': 'var(--color-neutral-500)',
  '--card-box-check': 'var(--card-on-accent)',
  '--card-quote': 'var(--color-neutral-600)',
  '--card-ring': 'none',
  '--card-logo-background': 'var(--card-accent)',
  '--card-logo-foreground': 'var(--card-on-accent)',
  '--card-inverted-logo-background': 'var(--card-accent)',
  '--card-inverted-logo-foreground': 'var(--card-on-accent)',
  '--card-logo-ring': 'none',
}

/*
  On the two dark ones, marks are drawn in what reads on the background, and the quiet parts fade.
  A day lit in a calendar is outlined in the text color, since its flame's background can be as
  dark as the card
*/
const DARK_TONE: Variables = {
  '--card-square': 'color-mix(in srgb, currentColor 15%, transparent)',
  '--card-cell-ring': 'inset 0 0 0 1px currentColor',
  '--card-box': 'transparent',
  '--card-quote': 'inherit',
  '--card-ring': 'none',
}

/*
  Every color a card's parts are drawn in, as custom properties on the card, for each tone it can
  be drawn on. Its parts read them through Tailwind's `(--card-…)` values, so a part looks right on
  any tone without knowing which one it is on
*/
const TONE_VARIABLES: Record<CardTone, Variables> = {
  white: {
    ...LIGHT_TONE,
    '--card-background': '#ffffff',
    '--card-ring': 'inset 0 0 0 1px var(--color-neutral-200)',
  },
  tint: {
    ...LIGHT_TONE,
    '--card-background': 'var(--card-accent-50)',
    '--card-panel': 'var(--card-accent-100)',
    // White, since the shade a lighter tone draws its tracks in hardly shows on this one
    '--card-track': '#ffffff',
  },
  neutral: {
    ...LIGHT_TONE,
    '--card-background': 'var(--color-neutral-100)',
    '--card-panel': '#ffffff',
    '--card-square': 'var(--color-neutral-200)',
  },
  accent: {
    ...DARK_TONE,
    '--card-background': 'var(--card-accent)',
    '--card-foreground': 'var(--card-on-accent)',
    '--card-mark': 'var(--card-on-accent)',
    '--card-strong': 'var(--card-on-accent)',
    // Darkened under white text and lightened under black, so the text reads on it too
    '--card-panel': 'color-mix(in oklch, var(--card-accent) 82%, var(--card-accent-shade))',
    '--card-track': 'color-mix(in srgb, var(--card-on-accent) 25%, transparent)',
    '--card-eyebrow': 'var(--card-on-accent)',
    '--card-muted': 'var(--card-on-accent)',
    '--card-url': 'var(--card-on-accent)',
    '--card-box-border': 'color-mix(in srgb, var(--card-on-accent) 80%, transparent)',
    '--card-box-check': 'var(--card-accent)',
    /*
      The logo turned inside out, since in the accent it would vanish into the card: in the text
      color, as the rest of what is written on it, or white where it stands as an emblem
    */
    '--card-logo-background': 'var(--card-on-accent)',
    '--card-logo-foreground': 'var(--card-accent)',
    '--card-inverted-logo-background': '#ffffff',
    '--card-inverted-logo-foreground': 'var(--card-accent)',
    '--card-logo-ring': 'none',
  },
  dark: {
    ...DARK_TONE,
    '--card-background': 'var(--color-secondary-900)',
    '--card-foreground': '#ffffff',
    '--card-mark': 'var(--card-accent-high)',
    '--card-strong': 'var(--card-accent-high)',
    '--card-panel': 'var(--color-secondary-800)',
    '--card-track': 'color-mix(in srgb, #ffffff 18%, transparent)',
    '--card-eyebrow': 'var(--card-accent-high)',
    '--card-muted': 'var(--color-neutral-300)',
    '--card-url': 'var(--color-neutral-300)',
    '--card-box-border': 'color-mix(in srgb, #ffffff 60%, transparent)',
    '--card-box-check': 'var(--color-secondary-900)',
    // Outlined, since an accent as dark as the card would leave nothing of the square
    '--card-logo-background': 'var(--card-accent)',
    '--card-logo-foreground': 'var(--card-on-accent)',
    '--card-inverted-logo-background': 'var(--card-accent)',
    '--card-inverted-logo-foreground': 'var(--card-on-accent)',
    '--card-logo-ring': 'inset 0 0 0 1px color-mix(in srgb, #ffffff 24%, transparent)',
  },
}

/*
  A flame's three layers, outside in, the outer one's edge, what it sits on when a day is lit, how
  an unlit one is outlined, and the battery of a day a charge kept: in the accent's shades, or in a
  real flame's reds and yellows whatever the tone, where the battery takes the text color rather
  than a red. A calendar's charged day is drawn on the flame's background too, its battery in
  `--flame-cell-foreground`, which a warm flame's light yellow needs dark
*/
function getFlameVariables(tone: CardTone, flameColor: FlameColor): Variables {
  const off: Variables = {
    '--flame-off':
      tone === 'accent' ? 'color-mix(in srgb, var(--card-on-accent) 65%, transparent)' : 'var(--color-neutral-500)',
  }

  if (flameColor === 'warm') {
    return {
      ...off,
      '--flame-outer': 'color-mix(in oklch, var(--color-danger) 45%, var(--color-warning))',
      // Edged in the text color on the accent, which can be as red as the flame
      '--flame-edge': tone === 'accent' ? 'var(--card-on-accent)' : 'var(--flame-outer)',
      '--flame-middle': 'color-mix(in oklch, var(--color-warning) 65%, white)',
      '--flame-inner': 'var(--color-warning-bg)',
      '--flame-background': 'var(--color-warning-bg)',
      '--flame-foreground': 'var(--color-secondary-900)',
      '--flame-cell-foreground': 'var(--color-secondary-900)',
      '--flame-charge': 'currentColor',
      // The yellow stands apart from every tone without an outline
      '--card-cell-ring': 'none',
    }
  }

  if (tone === 'accent' || tone === 'dark') {
    return {
      ...off,
      '--flame-outer': tone === 'accent' ? 'var(--card-on-accent)' : 'var(--card-accent-high)',
      '--flame-edge': 'var(--flame-outer)',
      '--flame-middle': tone === 'accent' ? 'var(--card-accent-light)' : '#ffffff',
      '--flame-inner': 'var(--card-accent)',
      '--flame-background': 'var(--card-panel)',
      '--flame-foreground': 'inherit',
      '--flame-cell-foreground': 'inherit',
      '--flame-charge': 'var(--flame-outer)',
    }
  }

  return {
    ...off,
    '--flame-outer': 'var(--card-accent-ink)',
    '--flame-edge': 'var(--flame-outer)',
    '--flame-middle': 'var(--card-accent-light)',
    '--flame-inner': '#ffffff',
    '--flame-background': 'var(--card-panel)',
    '--flame-foreground': 'inherit',
    '--flame-cell-foreground': 'inherit',
    '--flame-charge': 'var(--flame-outer)',
  }
}

/*
  The text forced into an ink: on the accent, what is written on it, which its marks, its quiet
  parts and its panel's shade follow; on any other tone, its text alone, the marks keeping the
  accent's shades
*/
function getInkVariables(tone: CardTone, ink: CardInk): Variables {
  const color = CARD_INK_COLORS[ink]

  if (tone === 'accent') {
    return { '--card-on-accent': color, '--card-accent-shade': ink === 'white' ? 'black' : 'white' }
  }

  return { '--card-foreground': color }
}

// The style of a card drawn on a tone, in an accent color, with its flames in either color, and its
// text in what reads on the tone unless an ink is forced
function getCardStyle(
  tone: CardTone,
  accent: string,
  flameColor: FlameColor = 'organization',
  ink?: CardInk,
): CSSProperties {
  return {
    ...getAccentVariables(accent),
    ...TONE_VARIABLES[tone],
    ...(ink ? getInkVariables(tone, ink) : {}),
    ...getFlameVariables(tone, flameColor),
    background: 'var(--card-background)',
    color: 'var(--card-foreground)',
    boxShadow: 'var(--card-ring)',
  } as CSSProperties
}

export default getCardStyle
