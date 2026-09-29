import { createContext } from 'react'
import type { CompanyAspect } from 'strategydance-database/web'

/*
  How far the chapter screen has got: up with its words hidden, the words fading in one after the
  other, the words gone while the screen holds, then the screen fading onto the page beneath
*/
export type AspectChapterPhase = 'pre' | 'in' | 'out' | 'gone'

export type AspectChapter = {
  aspect: CompanyAspect
  phase: AspectChapterPhase
}

/*
  The full screen an aspect opens with when the organization starts exploring it: its chapter's
  number, then its name, white on primary over the whole app.

  A context because the chapter outlives the page that starts it. The explore page plays it and
  opens the aspect's page beneath it, so the screen is drawn by the layout both pages share, and
  timed by a provider no navigation unmounts
*/
export type AspectChapterContextType = {
  // The chapter on screen, or null
  chapter: AspectChapter | null
  // Plays the aspect's chapter while `pageChange` settles beneath it, and lifts once both are done,
  // onto whichever page is there by then. Does nothing while a chapter is already on screen
  playChapter: (aspect: CompanyAspect, pageChange: Promise<unknown>) => void
}

export default createContext<AspectChapterContextType>({
  chapter: null,
  playChapter: () => {},
})
