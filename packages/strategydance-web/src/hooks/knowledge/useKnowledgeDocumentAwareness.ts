import { useEffect, useState } from 'react'
import { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

/*
  Where each writer's caret is in a document's text, this reader's included, which the editor
  draws for the others and fills in for this reader. Null until the effect has made it.

  An awareness keeps a timer, so the effect that destroys it makes it, and one destroyed keeps no
  state of this reader's, so none is ever reused: StrictMode's extra cycle destroys the first and
  makes a second. It reaches the page a microtask later, from the effect that is still running
*/
function useKnowledgeDocumentAwareness(doc: Y.Doc) {
  const [awareness, setAwareness] = useState<Awareness | null>(null)

  useEffect(() => {
    const next = new Awareness(doc)
    let isActive = true

    queueMicrotask(() => {
      if (isActive) setAwareness(next)
    })

    return () => {
      isActive = false
      next.destroy()
    }
  }, [doc])

  return awareness
}

export default useKnowledgeDocumentAwareness
