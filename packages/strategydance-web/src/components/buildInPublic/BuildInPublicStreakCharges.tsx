import { InfoIcon } from 'lucide-react'
import { useIntl } from 'react-intl'
import { Tooltip } from 'strategydance-design-system/components/ui/Tooltip'

import { MAX_STREAK_CHARGES } from '~constants'

import BuildInPublicBattery from '~components/buildInPublic/BuildInPublicBattery'

import buildInPublicMessages from '~data/intl/messages/buildInPublic'

type Props = {
  count: number
  // Today has no update yet, and is about to use a charge
  isPending: boolean
}

/*
  How many streak charges the reader holds, under the streak section's head. An info button says
  what a charge is, in a tooltip a phone opens with a tap, and a line says when today is about to
  use one. On the page only, never on a card: see `getStreakCharges`
*/
function BuildInPublicStreakCharges({ count, isPending }: Props) {
  const { formatMessage } = useIntl()

  return (
    <div className="-mt-3 flex max-w-xl items-start gap-3">
      <BuildInPublicBattery
        size={24}
        charges={count}
        className="text-secondary"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="m-0 flex items-center gap-1.5 text-sm leading-normal text-foreground">
          <span>
            {formatMessage(buildInPublicMessages.streakCharges, {
              count,
              total: MAX_STREAK_CHARGES,
              strong: chunks => <strong className="font-semibold text-secondary">{chunks}</strong>,
            })}
          </span>
          <Tooltip
            content={formatMessage(buildInPublicMessages.streakChargesHelp, { total: MAX_STREAK_CHARGES })}
            isOpenedOnTap
            isKeptOpenOnPress
          >
            <button
              type="button"
              aria-label={formatMessage(buildInPublicMessages.streakChargesHelpLabel)}
              className="inline-flex cursor-help rounded-xs text-muted-foreground hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
            >
              <InfoIcon className="size-4" />
            </button>
          </Tooltip>
        </p>
        {isPending ? (
          <p className="my-1.5 text-sm leading-normal text-pretty text-foreground">
            {formatMessage(buildInPublicMessages.streakChargePending)}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default BuildInPublicStreakCharges
