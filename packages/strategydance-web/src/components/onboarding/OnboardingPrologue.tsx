import { useEffect, useState } from 'react'
import { useIntl } from 'react-intl'
import { OrnamentDivider } from 'strategydance-design-system/components/brand/OrnamentDivider'
import { cn } from 'strategydance-design-system/lib/utils'

import onboardingMessages from '~data/intl/messages/onboarding'

// When each beat lands, in milliseconds from the mount: the title fades in, then the divider and
// the lines after it, all of it fades out together, and the quiz follows
const FADE_IN_AT = 200
const FADE_OUT_AT = 7400
const DONE_AT = 8400

type Props = {
  onDone: () => void
}

/*
  The opening screen, white on the primary color: a title, a divider and two lines, fading in one
  after the other and out together, then handing over to the quiz by itself. Nothing on it is
  interactive, and nothing skips it, as the design has it
*/
function OnboardingPrologue({ onDone }: Props) {
  const { formatMessage } = useIntl()
  const [isIn, setIsIn] = useState(false)

  useEffect(() => {
    const timeouts = [
      setTimeout(() => setIsIn(true), FADE_IN_AT),
      setTimeout(() => setIsIn(false), FADE_OUT_AT),
      setTimeout(onDone, DONE_AT),
    ]

    return () => timeouts.forEach(clearTimeout)
  }, [onDone])

  // The delays stagger the fade in only: on the way out everything leaves at once
  const fadeClassName = cn('transition-opacity duration-900 ease-in-out', isIn ? 'opacity-100' : 'opacity-0')

  return (
    <div className="flex max-w-[560px] flex-col items-center gap-6 p-6 text-center">
      <h1 className={cn('m-0 text-7xl leading-none text-white', fadeClassName)}>
        {formatMessage(onboardingMessages.prologueTitle)}
      </h1>
      <OrnamentDivider className={cn('text-white', fadeClassName, isIn && 'delay-1400')} />
      <p className={cn('m-0 -mt-2.5 text-xl leading-relaxed text-pretty text-white', fadeClassName, isIn && 'delay-2400')}>
        {formatMessage(onboardingMessages.prologueQuestion)}
        <br />
        {formatMessage(onboardingMessages.prologueLead)}
      </p>
    </div>
  )
}

export default OnboardingPrologue
