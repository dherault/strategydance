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
import useCurrentOrganization from '~hooks/organization/useCurrentOrganization'

import getCardStyle from '~utils/buildInPublic/getCardStyle'
import renderCardImage from '~utils/buildInPublic/renderCardImage'
import getLocalDate from '~utils/date/getLocalDate'

import BuildInPublicCardSettings from '~components/buildInPublic/BuildInPublicCardSettings'
import Spinner from '~components/common/Spinner'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// Each format's size in CSS pixels, which its picture doubles, and the ratio its caption names
const FORMATS: Record<CardFormat, { className: string; ratio: string }> = {
  landscape: { className: 'h-[338px] w-[600px]', ratio: '16:9' },
  square: { className: 'size-[338px]', ratio: '1:1' },
  portrait: { className: 'h-[422px] w-[338px]', ratio: '4:5' },
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
  children,
}: Props) {
  const { formatMessage } = useIntl()
  const { organization } = useCurrentOrganization()

  const surfaceRef = useRef<HTMLDivElement>(null)
  const [busyAction, setBusyAction] = useState<'copy' | 'download' | null>(null)

  const { look, changeLook, changeCard } = settings
  const tone = look.tone ?? defaultTone
  const accent = look.accent ?? 'organization'
  const organizationColor = organization?.color ?? DEFAULT_ORGANIZATION_COLOR
  const accentColor = accent === 'organization' ? organizationColor : CARD_ACCENT_COLORS[accent]
  const { className: formatClassName, ratio } = FORMATS[format]

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
    <figure className="group m-0 flex flex-wrap items-start gap-x-8 gap-y-6 self-stretch">
      <div className="flex max-w-full min-w-0 flex-none flex-col gap-2">
        <div className="max-w-full overflow-x-auto">
          <div
            ref={surfaceRef}
            className={cn(
              'relative box-border flex flex-none flex-col overflow-hidden rounded-xs font-sans antialiased',
              formatClassName,
              isFlush ? 'p-0' : 'px-7 pt-7 pb-11',
            )}
            style={getCardStyle(tone, accentColor, flameColor)}
          >
            {children}
            <span className="absolute right-5 bottom-4 text-[11px] leading-none font-medium tracking-[0.02em] text-(--card-url)">
              {PRODUCTION_APP_HOSTNAME}
            </span>
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
        <div className="mt-auto -ml-2 flex flex-wrap gap-1 whitespace-nowrap">
          <Button
            variant="transparent"
            size="sm"
            icon={busyAction === 'copy' ? <Spinner tone="current" /> : <CopyIcon />}
            aria-label={formatMessage(buildInPublicMessages.copyImageLabel, { card: label })}
            disabled={busyAction !== null}
            onClick={copy}
          >
            {formatMessage(buildInPublicMessages.copyImage)}
          </Button>
          <Button
            variant="transparent"
            size="sm"
            icon={busyAction === 'download' ? <Spinner tone="current" /> : <DownloadIcon />}
            aria-label={formatMessage(buildInPublicMessages.downloadImageLabel, { card: label })}
            disabled={busyAction !== null}
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
