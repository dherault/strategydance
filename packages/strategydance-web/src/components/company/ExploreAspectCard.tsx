import { Link } from '@tanstack/react-router'
import { ArrowRightIcon, CompassIcon } from 'lucide-react'
import type { MessageDescriptor } from 'react-intl'
import { useIntl } from 'react-intl'
import { CompanyAspect } from 'strategydance-database/web'
import { CompanyAspectIcon } from 'strategydance-design-system/components/company/CompanyAspectIcon'
import { Button } from 'strategydance-design-system/components/ui/Button'
import { cn } from 'strategydance-design-system/lib/utils'

import toAspectSlug from '~utils/company/toAspectSlug'

import Spinner from '~components/common/Spinner'

import aspectMessages from '~data/intl/aspectMessages'
import exploreMessages from '~data/intl/messages/explore'

const blurbMessages: Record<CompanyAspect, MessageDescriptor> = {
  [CompanyAspect.STRATEGY]: exploreMessages.blurbStrategy,
  [CompanyAspect.PEOPLE]: exploreMessages.blurbPeople,
  [CompanyAspect.FINANCES]: exploreMessages.blurbFinances,
  [CompanyAspect.PRODUCT]: exploreMessages.blurbProduct,
  [CompanyAspect.ENGINEERING]: exploreMessages.blurbEngineering,
  [CompanyAspect.DESIGN]: exploreMessages.blurbDesign,
  [CompanyAspect.MARKETING]: exploreMessages.blurbMarketing,
  [CompanyAspect.SALES]: exploreMessages.blurbSales,
  [CompanyAspect.LEGAL]: exploreMessages.blurbLegal,
}

// The card's frame. Its last child, the call to action, sinks to the bottom so a row lines up
const cardClassName = 'relative flex flex-col gap-4 rounded-xs border bg-card p-6 transition-colors duration-150 ease-in-out *:last:mt-auto'

type Props = {
  aspect: CompanyAspect
  isExplored: boolean
  isStarting: boolean
  // While another aspect is being added, or with no organization to add it to
  isDisabled: boolean
  onStart: () => void
}

/*
  An aspect, as the prototype draws it. One already explored is a quiet link to its page; one
  that is not stands out in primary, and the whole card starts it, the button being what the
  keyboard reaches
*/
function ExploreAspectCard({ aspect, isExplored, isStarting, isDisabled, onStart }: Props) {
  const { formatMessage } = useIntl()

  const body = (
    <>
      <span className={cn('grid size-10 place-items-center rounded-xs', isExplored ? 'bg-neutral-100 text-muted-foreground' : 'bg-primary-50 text-primary')}>
        <CompanyAspectIcon
          aspect={toAspectSlug(aspect)}
          size={20}
        />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className={cn('m-0 text-2xl leading-[1.15] tracking-[-0.01em]', isExplored && 'text-neutral-600')}>
          {formatMessage(aspectMessages[aspect])}
        </h2>
        <p className="m-0 text-sm leading-normal text-pretty text-muted-foreground">
          {formatMessage(blurbMessages[aspect])}
        </p>
      </div>
    </>
  )

  if (isExplored) {
    return (
      <Link
        to="/-/$aspect"
        params={{ aspect }}
        className={cn(cardClassName, 'group border-neutral-200 text-inherit no-underline hover:border-neutral-300 hover:text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary')}
      >
        {body}
        <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 group-hover:text-neutral-900">
          {formatMessage(exploreMessages.open)}
          <ArrowRightIcon className="size-4 transition-transform duration-150 ease-in-out group-hover:translate-x-0.5" />
        </span>
      </Link>
    )
  }

  return (
    <div
      onClick={isDisabled ? undefined : onStart}
      className={cn(cardClassName, 'border-primary', isDisabled ? 'cursor-default' : 'cursor-pointer hover:border-primary-800')}
    >
      {body}
      <div>
        <Button
          size="sm"
          icon={isStarting ? <Spinner tone="current" /> : <CompassIcon />}
          disabled={isDisabled}
          onClick={event => {
            event.stopPropagation()
            onStart()
          }}
        >
          {formatMessage(exploreMessages.start)}
        </Button>
      </div>
    </div>
  )
}

export default ExploreAspectCard
