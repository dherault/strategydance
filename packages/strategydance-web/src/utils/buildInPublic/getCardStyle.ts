import type { CSSProperties } from 'react'
import { isDarkColor } from 'strategydance-design-system/lib/isDarkColor'

import type { CardTone, FlameColor } from '~types'

type Variables = Record<`--${string}`, string>

// The accent, whatever the card is drawn on, with what reads on it and three lighter shades of it
function getAccentVariables(accent: string): Variables {
  return {
    '--card-accent': accent,
    '--card-on-accent': isDarkColor(accent) ? '#ffffff' : '#000000',
    '--card-accent-50': `color-mix(in oklch, ${accent} 8%, white)`,
    '--card-accent-100': `color-mix(in oklch, ${accent} 16%, white)`,
    '--card-accent-light': `color-mix(in oklch, ${accent} 50%, white)`,
  }
}

// On the three light tones the accent marks things, and a white or tinted panel sets one part apart
const LIGHT_TONE: Variables = {
  '--card-foreground': 'var(--color-secondary-900)',
  '--card-mark': 'var(--card-accent)',
  '--card-strong': 'var(--card-accent)',
  '--card-panel': 'var(--card-accent-50)',
  '--card-track': 'var(--card-accent-100)',
  '--card-eyebrow': 'var(--card-accent)',
  '--card-muted': 'var(--color-neutral-600)',
  '--card-url': 'var(--color-neutral-500)',
  '--card-square': 'var(--color-neutral-100)',
  '--card-box': '#ffffff',
  '--card-box-border': 'var(--color-neutral-300)',
  '--card-box-check': 'var(--card-on-accent)',
  '--card-quote': 'var(--color-neutral-600)',
  '--card-ring': 'none',
}

// On the two dark ones, marks are drawn in what reads on the background, and the quiet parts fade
const DARK_TONE: Variables = {
  '--card-square': 'color-mix(in srgb, currentColor 15%, transparent)',
  '--card-box': 'transparent',
  '--card-box-border': 'color-mix(in srgb, currentColor 45%, transparent)',
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
    '--card-panel': 'color-mix(in oklch, var(--card-accent) 82%, black)',
    '--card-track': 'color-mix(in srgb, var(--card-on-accent) 25%, transparent)',
    '--card-eyebrow': 'var(--card-on-accent)',
    '--card-muted': 'var(--card-on-accent)',
    '--card-url': 'var(--card-on-accent)',
    '--card-box-check': 'var(--card-accent)',
  },
  dark: {
    ...DARK_TONE,
    '--card-background': 'var(--color-secondary-900)',
    '--card-foreground': '#ffffff',
    '--card-mark': 'var(--card-accent-light)',
    '--card-strong': 'var(--card-accent-light)',
    '--card-panel': 'var(--color-secondary-800)',
    '--card-track': 'color-mix(in srgb, #ffffff 18%, transparent)',
    '--card-eyebrow': 'var(--card-accent-light)',
    '--card-muted': 'var(--color-neutral-300)',
    '--card-url': 'var(--color-neutral-300)',
    '--card-box-check': 'var(--color-secondary-900)',
  },
}

/*
  A flame's three layers, outside in, what it sits on when a day is lit, and how an unlit one is
  outlined: in the accent's shades, or in a real flame's reds and yellows whatever the tone
*/
function getFlameVariables(tone: CardTone, flameColor: FlameColor): Variables {
  const off: Variables = {
    '--flame-off':
      tone === 'accent'
        ? 'color-mix(in srgb, var(--card-on-accent) 40%, transparent)'
        : tone === 'dark'
          ? 'var(--color-neutral-600)'
          : 'var(--color-neutral-300)',
  }

  if (flameColor === 'warm') {
    return {
      ...off,
      '--flame-outer': 'color-mix(in oklch, var(--color-danger) 45%, var(--color-warning))',
      '--flame-middle': 'color-mix(in oklch, var(--color-warning) 65%, white)',
      '--flame-inner': 'var(--color-warning-bg)',
      '--flame-background': 'var(--color-warning-bg)',
      '--flame-foreground': 'var(--color-secondary-900)',
    }
  }

  if (tone === 'accent' || tone === 'dark') {
    return {
      ...off,
      '--flame-outer': tone === 'accent' ? 'var(--card-on-accent)' : 'var(--card-accent-light)',
      '--flame-middle': tone === 'accent' ? 'var(--card-accent-light)' : '#ffffff',
      '--flame-inner': 'var(--card-accent)',
      '--flame-background': 'var(--card-panel)',
      '--flame-foreground': 'inherit',
    }
  }

  return {
    ...off,
    '--flame-outer': 'var(--card-accent)',
    '--flame-middle': 'var(--card-accent-light)',
    '--flame-inner': '#ffffff',
    '--flame-background': 'var(--card-panel)',
    '--flame-foreground': 'inherit',
  }
}

// The style of a card drawn on a tone, in an accent color, with its flames in either color
function getCardStyle(tone: CardTone, accent: string, flameColor: FlameColor = 'organization'): CSSProperties {
  return {
    ...getAccentVariables(accent),
    ...TONE_VARIABLES[tone],
    ...getFlameVariables(tone, flameColor),
    background: 'var(--card-background)',
    color: 'var(--card-foreground)',
    boxShadow: 'var(--card-ring)',
  } as CSSProperties
}

export default getCardStyle
