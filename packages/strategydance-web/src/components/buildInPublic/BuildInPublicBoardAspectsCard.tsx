import { useIntl } from 'react-intl'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { cn } from 'strategydance-design-system/lib/utils'

import type { Task } from '~types'

import type useBuildInPublicSettings from '~hooks/buildInPublic/useBuildInPublicSettings'

import getBoardStats from '~utils/buildInPublic/getBoardStats'
import toAspectSlug from '~utils/company/toAspectSlug'

import BuildInPublicBar from '~components/buildInPublic/BuildInPublicBar'
import BuildInPublicCard from '~components/buildInPublic/BuildInPublicCard'
import {
  CARD_DISPLAY_CLASS_NAME,
  CARD_EYEBROW_CLASS_NAME,
  CARD_MUTED_CLASS_NAME,
} from '~components/buildInPublic/cardClassNames'

import aspectMessages from '~data/intl/aspectMessages'
import buildInPublicMessages from '~data/intl/messages/buildInPublic'

// As many as the card holds
const MAX_ASPECTS = 6

type Props = {
  settings: ReturnType<typeof useBuildInPublicSettings>
  tasks: readonly Task[]
}

// The aspects of the company the board's tasks are about, those with the most tasks first, each
// with how many of its tasks are done. Nothing while no task is about any
function BuildInPublicBoardAspectsCard({ settings, tasks }: Props) {
  const { formatMessage } = useIntl()

  const { aspects } = getBoardStats(tasks)

  if (!aspects.length) return null

  return (
    <BuildInPublicCard
      cardKey="board-aspects"
      label={formatMessage(buildInPublicMessages.aspectsCard)}
      format="portrait"
      tone="tint"
      settings={settings}
    >
      <p className={CARD_EYEBROW_CLASS_NAME}>{formatMessage(buildInPublicMessages.acrossCompany)}</p>
      <p className={cn(CARD_DISPLAY_CLASS_NAME, 'mt-2 text-[26px]/[1.12]')}>
        {formatMessage(buildInPublicMessages.aspectsInMotion, { count: aspects.length })}
      </p>
      <div className="mt-auto flex flex-col gap-3">
        {aspects.slice(0, MAX_ASPECTS).map(({ aspect, total, done }) => (
          <div
            key={aspect}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2 text-[13px]">
              <CompanyAspectIcon
                aspect={toAspectSlug(aspect)}
                size={14}
                className="flex-none"
              />
              <span className="min-w-0 flex-1 truncate font-medium">{formatMessage(aspectMessages[aspect])}</span>
              <span className={cn(CARD_MUTED_CLASS_NAME, 'tabular-nums')}>
                {done}/{total}
              </span>
            </div>
            <BuildInPublicBar
              ratio={done / total}
              className="h-1.5"
            />
          </div>
        ))}
      </div>
    </BuildInPublicCard>
  )
}

export default BuildInPublicBoardAspectsCard
