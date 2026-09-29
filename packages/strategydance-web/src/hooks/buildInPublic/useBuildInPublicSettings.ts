import type { BuildInPublicSettings, CardLook, CardValues } from '~types'

import { CARD_ACCENT_COLORS, CARD_TONES } from '~constants'

import useAuthentication from '~hooks/authentication/useAuthentication'
import usePersistedState from '~hooks/common/usePersistedState'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

const EMPTY_SETTINGS: BuildInPublicSettings = {
  look: {},
  shared: {},
  cards: {},
}

/*
  The settings every card that has them shares, rather than each keeping its own: the flames'
  color, and whose priority or log the cards show. Picking a teammate on one card picks them on all
*/
const SHARED_KEYS = ['flame', 'user']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// What was stored for a card, keeping only strings and lists of strings, since the stored value
// is whatever the browser kept, from any version of the page
function parseValues(value: unknown): CardValues {
  if (!isRecord(value)) return {}

  const values: CardValues = {}

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') values[key] = item
    else if (Array.isArray(item) && item.every(element => typeof element === 'string')) values[key] = item
  }

  return values
}

function parseLook(value: unknown): CardLook {
  if (!isRecord(value)) return {}

  const look: CardLook = {}
  const tone = CARD_TONES.find(cardTone => cardTone === value.tone)

  if (tone) look.tone = tone
  // An own key only: `in` would also take `constructor` or `toString` for a color
  if (
    value.accent === 'organization'
    || (typeof value.accent === 'string' && Object.hasOwn(CARD_ACCENT_COLORS, value.accent))
  ) {
    look.accent = value.accent as CardLook['accent']
  }

  return look
}

function parseSettings(value: unknown): BuildInPublicSettings {
  if (!isRecord(value)) return EMPTY_SETTINGS

  const cards: Record<string, CardValues> = {}

  if (isRecord(value.cards)) {
    for (const [cardKey, cardValues] of Object.entries(value.cards)) cards[cardKey] = parseValues(cardValues)
  }

  return {
    look: parseLook(value.look),
    shared: parseValues(value.shared),
    cards,
  }
}

/*
  What the reader chose on the build in public page, kept in their browser per organization: the
  look every card shares, and each card's settings. Nothing here is anybody else's business, so it
  stays out of the database, as the task list the Today page last opened does.

  A card reads its settings over its defaults, and a stored value that is not of its default's kind
  is ignored. Whether a stored option still exists, a list since deleted or a teammate since gone,
  is for the card to say, since only it knows its options
*/
function useBuildInPublicSettings() {
  const { data: viewer } = useAuthentication()
  const { organization } = useCurrentOrganization()

  const [settings, setSettings] = usePersistedState<BuildInPublicSettings>(
    `buildInPublic:${viewer?.uid ?? ''}:${organization?.id ?? ''}`,
    EMPTY_SETTINGS,
    { parser: parseSettings },
  )

  function changeLook(look: CardLook) {
    setSettings(current => ({ ...current, look }))
  }

  function readCard<Values extends CardValues>(cardKey: string, defaults: Values): Values {
    const own = settings.cards[cardKey] ?? {}
    const values: CardValues = { ...defaults }

    for (const [key, fallback] of Object.entries(defaults)) {
      const stored = SHARED_KEYS.includes(key) ? (settings.shared[key] ?? own[key]) : own[key]

      if (stored !== undefined && Array.isArray(stored) === Array.isArray(fallback)) values[key] = stored
    }

    return values as Values
  }

  function changeCard(cardKey: string, values: CardValues) {
    const own: CardValues = {}
    const shared: CardValues = {}

    for (const [key, value] of Object.entries(values)) {
      if (SHARED_KEYS.includes(key)) shared[key] = value
      else own[key] = value
    }

    setSettings(current => ({
      ...current,
      shared: { ...current.shared, ...shared },
      cards: { ...current.cards, [cardKey]: own },
    }))
  }

  return { look: settings.look, changeLook, readCard, changeCard }
}

export default useBuildInPublicSettings
