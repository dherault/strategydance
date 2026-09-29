import { type PropsWithChildren, useState } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

import type { AspectChapter, AspectChapterContextType, AspectChapterPhase } from '~contexts/AspectChapterContext'
import AspectChapterContext from '~contexts/AspectChapterContext'

import sleep from '~utils/common/sleep'

// When each beat lands, in milliseconds from the start, as the design has it: the words fade in,
// then out together, and the screen lifts. The last is how long `AspectChapter` takes to fade
// out, after which it unmounts
const FADE_IN_AT = 200
const FADE_OUT_AT = 5000
const LIFT_AT = 6000
const LIFT_DURATION = 800

/*
  Tells an aspect's chapter, and holds how far it has got for `AspectChapter` to draw.

  The timing lives here rather than in the screen, because the screen belongs to a layout: a
  timing held in the layout's effects would stop if it unmounted mid chapter, and leave the chapter
  on screen the next time it mounted. Started from a click rather than an effect, it runs once and
  ends by itself, whatever renders it.

  Mounted in `Wrap`, and like every provider there it renders its children unconditionally
*/
function AspectChapterProvider({ children }: PropsWithChildren) {
  const [chapter, setChapter] = useState<AspectChapter | null>(null)

  function setPhase(phase: AspectChapterPhase) {
    setChapter(current => current && { ...current, phase })
  }

  /*
    The beats are timed from the start rather than from each other. The lift also waits for the
    page change, whether it worked or not. One slower than the telling holds the screen, its words
    gone, rather than lifting onto the page it is leaving. One that failed lifts onto the page that
    started it, which says what went wrong
  */
  async function playChapter(aspect: CompanyAspect, pageChange: Promise<unknown>) {
    if (chapter) return

    const fadeIn = sleep(FADE_IN_AT)
    const fadeOut = sleep(FADE_OUT_AT)
    const lift = Promise.allSettled([sleep(LIFT_AT), pageChange])

    setChapter({ aspect, phase: 'pre' })

    await fadeIn
    setPhase('in')

    await fadeOut
    setPhase('out')

    await lift
    setPhase('gone')

    await sleep(LIFT_DURATION)
    setChapter(null)
  }

  const contextValue: AspectChapterContextType = {
    chapter,
    playChapter,
  }

  return <AspectChapterContext.Provider value={contextValue}>{children}</AspectChapterContext.Provider>
}

export default AspectChapterProvider
