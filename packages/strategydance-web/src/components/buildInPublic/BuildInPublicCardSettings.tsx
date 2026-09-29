import { useIntl } from 'react-intl'
import { MultiSelect } from 'strategydance-design-system/components/ui/MultiSelect'
import { Select } from 'strategydance-design-system/components/ui/Select'

import type { CardAccent, CardField, CardTone, CardValues } from '~types'

import { CARD_ACCENT_COLORS, CARD_TONES } from '~constants'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

const TONE_MESSAGES = {
  accent: buildInPublicMessages.toneAccent,
  tint: buildInPublicMessages.toneTint,
  white: buildInPublicMessages.toneWhite,
  neutral: buildInPublicMessages.toneNeutral,
  dark: buildInPublicMessages.colorNavy,
}

const ACCENT_MESSAGES = {
  blue: buildInPublicMessages.colorBlue,
  sky: buildInPublicMessages.colorSky,
  navy: buildInPublicMessages.colorNavy,
  indigo: buildInPublicMessages.colorIndigo,
  violet: buildInPublicMessages.colorViolet,
  fuchsia: buildInPublicMessages.colorFuchsia,
  pink: buildInPublicMessages.colorPink,
  red: buildInPublicMessages.colorRed,
  orange: buildInPublicMessages.colorOrange,
  amber: buildInPublicMessages.colorAmber,
  lime: buildInPublicMessages.colorLime,
  green: buildInPublicMessages.colorGreen,
  teal: buildInPublicMessages.colorTeal,
  graphite: buildInPublicMessages.colorGraphite,
  black: buildInPublicMessages.colorBlack,
}

// An option's color, as a small square before its name
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <i
        className="size-3 flex-none rounded-xs shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
        style={{ background: color }}
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

type Props = {
  // The card's name, for the group's accessible name
  label: string
  fields: CardField[]
  values: CardValues
  onValuesChange: (values: CardValues) => void
  tone: CardTone
  onToneChange: (tone: CardTone) => void
  accent: CardAccent
  onAccentChange: (accent: CardAccent) => void
  // The hex the card's accent is now, and the organization's own
  accentColor: string
  organizationColor: string
}

/*
  What a card lets the reader change, beside it: its own settings, then what it is drawn on and in
  which color, which every card shares.

  A pick of several keeps the options' order rather than the order they were picked in, never
  empties, since a card of nothing says nothing, and stops at its most: past it, the options not
  picked are disabled until one is let go
*/
function BuildInPublicCardSettings({
  label,
  fields,
  values,
  onValuesChange,
  tone,
  onToneChange,
  accent,
  onAccentChange,
  accentColor,
  organizationColor,
}: Props) {
  const { formatMessage } = useIntl()

  const toneSwatches: Record<CardTone, string> = {
    accent: accentColor,
    tint: `color-mix(in oklch, ${accentColor} 16%, white)`,
    white: '#ffffff',
    neutral: 'var(--color-neutral-100)',
    dark: 'var(--color-secondary-900)',
  }

  function change(key: string, value: string | string[]) {
    onValuesChange({ ...values, [key]: value })
  }

  return (
    <div
      role="group"
      aria-label={formatMessage(buildInPublicMessages.customize, { card: label })}
      className="flex flex-col gap-4"
    >
      {fields.map(field => {
        if (field.kind === 'select') {
          return (
            <Select
              key={field.key}
              label={field.label}
              value={values[field.key] as string}
              options={field.options}
              onValueChange={value => change(field.key, value)}
            />
          )
        }

        const picked = (values[field.key] as string[] | undefined) ?? []
        const isFull = field.max !== undefined && picked.length >= field.max

        return (
          <MultiSelect
            key={field.key}
            label={field.label}
            hint={
              field.max !== undefined && field.options.length > field.max
                ? formatMessage(buildInPublicMessages.upTo, { count: field.max })
                : undefined
            }
            value={picked}
            clearable={false}
            options={field.options.map(option => ({
              ...option,
              disabled: isFull && !picked.includes(option.value),
            }))}
            onValueChange={next => {
              if (!next.length) return

              change(
                field.key,
                field.options
                  .map(option => option.value)
                  .filter(value => next.includes(value))
                  .slice(0, field.max),
              )
            }}
          />
        )
      })}
      <Select
        label={formatMessage(buildInPublicMessages.background)}
        value={tone}
        options={CARD_TONES.map(cardTone => ({
          value: cardTone,
          label: (
            <Swatch
              color={toneSwatches[cardTone]}
              label={formatMessage(TONE_MESSAGES[cardTone])}
            />
          ),
        }))}
        onValueChange={value => onToneChange(value as CardTone)}
      />
      <Select
        label={formatMessage(buildInPublicMessages.accentColor)}
        value={accent}
        options={[
          {
            value: 'organization',
            label: (
              <Swatch
                color={organizationColor}
                label={formatMessage(buildInPublicMessages.companyColor)}
              />
            ),
          },
          ...Object.entries(CARD_ACCENT_COLORS).map(([name, color]) => ({
            value: name,
            label: (
              <Swatch
                color={color}
                label={formatMessage(ACCENT_MESSAGES[name as keyof typeof CARD_ACCENT_COLORS])}
              />
            ),
          })),
        ]}
        onValueChange={value => onAccentChange(value as CardAccent)}
      />
    </div>
  )
}

export default BuildInPublicCardSettings
