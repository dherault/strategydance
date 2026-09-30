import { CopyIcon, DownloadIcon } from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import { DEFAULT_ORGANIZATION_COLOR, PRODUCTION_APP_HOSTNAME } from 'strategydance-core'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { toast } from 'strategydance-design-system/components/ui/Toaster'
import { cn } from 'strategydance-design-system/lib/utils'

import type { CardField, CardFormat, CardTone, CardValues, FlameColor } from '~types'

import { CARD_ACCENT_COLORS } from '~constants'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'
import useCardScale from '~hooks/buildInPublic/useCardScale'
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getCardStyle from '~utils/buildInPublic/getCardStyle'
import renderCardImage from '~utils/buildInPublic/renderCardImage'
import getLocalDate from '~utils/date/getLocalDate'

import BuildInPublicCardSettings from '~components/buildInPublic/BuildInPublicCardSettings'
import Spinner from '~components/common/Spinner'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// Each format's size in CSS pixels, which its picture doubles, and the ratio its caption names
const FORMATS: Record<CardFormat, { width: number; height: number; ratio: string }> = {
  landscape: { width: 600, height: 338, ratio: '16:9' },
  square: { width: 338, height: 338, ratio: '1:1' },
  portrait: { width: 338, height: 422, ratio: '4:5' },
}

type Props = {
  // Stable and in English, for the file it downloads to and the settings it keeps
  cardKey: string
  label: string
  format: CardFormat
  // What it is drawn on until the reader picks a look for every card
  tone: CardTone
  // Laid edge to edge, for a card split into panels that pad themselves
  isFlush?: boolean
  settings: ReturnType<typeof useBuildInPublicSettings>
  fields?: CardField[]
  values?: CardValues
  flameColor?: FlameColor
  // Why it may not be copied or downloaded yet, such as a card standing in for what is not written
  exportDisabledReason?: string
  children: ReactNode
}

/*
  One card of the build in public page: the card itself, at the size its picture is drawn at, its
  name and ratio under it, and beside it what it lets the reader change and the buttons that copy
  or download it.

  The side appears as the card is pointed at or focused, and stays while one of its pickers is
  open, since their lists are laid over the page outside the card: Radix marks an open trigger
  `data-state="open"`, and Base UI `data-popup-open`. Where nothing hovers it is always there
*/
function BuildInPublicCard({
  cardKey,
  label,
  format,
  tone: defaultTone,
  isFlush = false,
  settings,
  fields = [],
  values = {},
  flameColor,
  exportDisabledReason,
  children,
}: Props) {
  const { formatMessage } = useIntl()
  const { organization } = useCurrentOrganization()

  const figureRef = useRef<HTMLElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const [busyAction, setBusyAction] = useState<'copy' | 'download' | null>(null)

  const { look, changeLook, changeCard } = settings
  const tone = look.tone ?? defaultTone
  const accent = look.accent ?? 'organization'
  const organizationColor = organization?.color ?? DEFAULT_ORGANIZATION_COLOR
  const accentColor = accent === 'organization' ? organizationColor : CARD_ACCENT_COLORS[accent]
  const { width, height, ratio } = FORMATS[format]
  const scale = useCardScale(figureRef, width)

  async function download() {
    if (!surfaceRef.current) return

    setBusyAction('download')

    try {
      const blob = await renderCardImage(surfaceRef.current)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `strategy-dance-${cardKey}-${getLocalDate(Date.now())}.png`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(formatMessage(buildInPublicMessages.imageDownloaded))
    } catch (error) {
      console.error('Failed to draw a card as an image', error)
      toast.error(formatMessage(buildInPublicMessages.imageFailed))
    } finally {
      setBusyAction(null)
    }
  }

  async function copy() {
    if (!surfaceRef.current) return

    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      toast.error(formatMessage(buildInPublicMessages.copyUnsupported))

      return
    }

    setBusyAction('copy')

    try {
      // The picture is handed over as a promise, so the clipboard is written within the click
      // that asked for it, which Safari requires, while the picture is still being drawn
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderCardImage(surfaceRef.current) })])
      toast.success(formatMessage(buildInPublicMessages.imageCopied))
    } catch (error) {
      console.error('Failed to copy a card as an image', error)
      toast.error(formatMessage(buildInPublicMessages.copyFailed))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <figure
      ref={figureRef}
      className="group m-0 flex flex-wrap items-start gap-x-8 gap-y-6 self-stretch"
    >
      <div className="flex max-w-full min-w-0 flex-none flex-col gap-2">
        {/*
          Where the page is narrower than the card, as a phone is than a landscape one, the card is
          drawn smaller in a box of the size it then takes. The scale is on a wrapper rather than on
          the card, whose own styles its picture copies, so the picture keeps the card's size
        */}
        <div
          className="overflow-hidden"
          style={{ width: width * scale, height: height * scale }}
        >
          <div
            className="origin-top-left"
            style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
          >
            <div
              ref={surfaceRef}
              className={cn(
                'relative box-border flex flex-none flex-col overflow-hidden rounded-xs font-sans antialiased',
                isFlush ? 'p-0' : 'px-7 pt-7 pb-11',
              )}
              style={{ ...getCardStyle(tone, accentColor, flameColor), width, height }}
            >
              {children}
              <span className="absolute right-5 bottom-4 text-[11px] leading-none font-medium tracking-[0.02em] text-(--card-url)">
                {PRODUCTION_APP_HOSTNAME}
              </span>
            </div>
          </div>
        </div>
        <figcaption className="text-xs text-muted-foreground">
          {formatMessage(buildInPublicMessages.caption, { card: label, ratio })}
        </figcaption>
      </div>
      <div
        className={cn(
          'flex w-[260px] flex-col gap-6 self-stretch pb-6 transition duration-150 ease-in-out',
          'translate-x-[-4px] opacity-0 group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100',
          'group-has-[[data-popup-open]]:translate-x-0 group-has-[[data-popup-open]]:opacity-100 group-has-[[data-state=open]]:translate-x-0 group-has-[[data-state=open]]:opacity-100',
          'max-md:translate-x-0 max-md:opacity-100 pointer-coarse:translate-x-0 pointer-coarse:opacity-100',
        )}
      >
        <BuildInPublicCardSettings
          label={label}
          fields={fields}
          values={values}
          onValuesChange={next => changeCard(cardKey, next)}
          tone={tone}
          onToneChange={nextTone => changeLook({ ...look, tone: nextTone })}
          accent={accent}
          onAccentChange={nextAccent => changeLook({ ...look, accent: nextAccent })}
          accentColor={accentColor}
          organizationColor={organizationColor}
        />
        {/* Each label on one line, the second button wrapping under the first where the two run
            wider than the column, as they do in French or German */}
        {exportDisabledReason ? (
          <p className="mt-auto mb-0 text-xs text-muted-foreground">{exportDisabledReason}</p>
        ) : null}
        <div className={cn('-ml-2 flex flex-wrap gap-1 whitespace-nowrap', !exportDisabledReason && 'mt-auto')}>
          <Button
            variant="transparent"
            size="sm"
            icon={busyAction === 'copy' ? <Spinner tone="current" /> : <CopyIcon />}
            aria-label={formatMessage(buildInPublicMessages.copyImageLabel, { card: label })}
            disabled={busyAction !== null || !!exportDisabledReason}
            onClick={copy}
          >
            {formatMessage(buildInPublicMessages.copyImage)}
          </Button>
          <Button
            variant="transparent"
            size="sm"
            icon={busyAction === 'download' ? <Spinner tone="current" /> : <DownloadIcon />}
            aria-label={formatMessage(buildInPublicMessages.downloadImageLabel, { card: label })}
            disabled={busyAction !== null || !!exportDisabledReason}
            onClick={download}
          >
            {formatMessage(buildInPublicMessages.downloadImage)}
          </Button>
        </div>
      </div>
    </figure>
  )
}

export default BuildInPublicCard
