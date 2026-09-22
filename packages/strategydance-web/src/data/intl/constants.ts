import type { Locale } from 'strategydance-core'

// Each language named in itself rather than in the reader's current one: somebody who has landed in
// a language they cannot read has to be able to find their way out
export const LOCALE_DISPLAY: Record<Locale, { emoji: string, label: string }> = {
  EN: { emoji: '🇺🇸', label: 'English' },
  FR: { emoji: '🇫🇷', label: 'Français' },
  ES: { emoji: '🇪🇸', label: 'Español' },
  DE: { emoji: '🇩🇪', label: 'Deutsch' },
  PT: { emoji: '🇵🇹', label: 'Português' },
  ZH: { emoji: '🇨🇳', label: '中文' },
  JA: { emoji: '🇯🇵', label: '日本語' },
}
