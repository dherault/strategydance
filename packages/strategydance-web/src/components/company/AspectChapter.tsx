import { useEffect, useId, useRef, useState } from 'react'
import { useIntl } from 'react-intl'
import type { CompanyAspect } from 'strategydance-database/web'
import { OrnamentDivider } from 'strategydance-design-system/components/brand/OrnamentDivider'
import { cn } from 'strategydance-design-system/lib/utils'

import { COMPANY_ASPECTS } from '~constants'

import type { AspectChapterPhase } from '~contexts/AspectChapterContext'

import aspectMessages from '~data/intl/aspectMessages'
import navigationMessages from '~data/intl/messages/navigation'

type Props = {
  aspect: CompanyAspect
  phase: AspectChapterPhase
}

/*
  The screen an aspect opens with, white on primary over the whole app: the chapter's number, a
  divider and the aspect's name, fading in one after the other and out together, then the screen
  itself fading onto the page beneath. It appears at once, with no fade, and nothing on it is
  interactive or skips it, as the design has it. `_AspectChapterProvider` times it.

  The number is the aspect's place in the order the sidebar and the explore page list them.

  It takes focus when it appears, so a screen reader announces the chapter. The layout makes the
  app beneath it inert meanwhile, which is what makes it modal. Once it is gone it hands focus back
  to what had it, if that is still on the page: the button that started it, after a write that
  failed. After a page change that button went with its page, and focus is left where it falls
*/
function AspectChapter({ aspect, phase }: Props) {
  const { formatMessage } = useIntl()
  const id = useId()
  const screenRef = useRef<HTMLDivElement>(null)

  // Read on the first render, before the commit that makes the app inert takes focus from it
  const [opener] = useState(() => document.activeElement)

  useEffect(() => {
    screenRef.current?.focus()

    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [opener])

  const numberId = `${id}-number`
  const nameId = `${id}-name`
  const isIn = phase === 'in'

  // The delays stagger the fade in only: on the way out everything leaves at once
  const fadeClassName = cn('transition-opacity duration-900 ease-in-out', isIn ? 'opacity-100' : 'opacity-0')

  return (
    <div
      ref={screenRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${numberId} ${nameId}`}
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-1000 flex items-center justify-center bg-primary outline-none transition-opacity duration-800 ease-in-out',
        phase === 'gone' && 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex max-w-[560px] flex-col items-center gap-6 p-6 text-center text-white">
        <p
          id={numberId}
          className={cn('m-0 text-3xl font-medium tracking-wider uppercase', fadeClassName)}
        >
          {formatMessage(navigationMessages.chapter, { number: COMPANY_ASPECTS.indexOf(aspect) + 1 })}
        </p>
        <OrnamentDivider className={cn(fadeClassName, isIn && 'delay-1000')} />
        <h1
          id={nameId}
          className={cn('m-0 text-7xl leading-none text-white', fadeClassName, isIn && 'delay-1800')}
        >
          {formatMessage(aspectMessages[aspect])}
        </h1>
      </div>
    </div>
  )
}

export default AspectChapter
