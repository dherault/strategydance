import { use } from 'react'

import AspectChapterContext from '~contexts/AspectChapterContext'

function useAspectChapter() {
  return use(AspectChapterContext)
}

export default useAspectChapter
