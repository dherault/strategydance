import { useEffect, useState } from 'react'

type RichTextEditorModule = typeof import('strategydance-design-system/components/ui/RichTextEditor')

// One download for every editor on the page, started by the first that mounts
let modulePromise: Promise<RichTextEditorModule> | null = null

function loadRichTextEditor() {
  modulePromise ??= import('strategydance-design-system/components/ui/RichTextEditor').catch(error => {
    // A later editor tries again rather than inheriting the failure
    modulePromise = null

    throw error
  })

  return modulePromise
}

/*
  The design system's rich text editor, fetched only once a page asks for one, so Lexical stays out
  of the bundle the Today page first paints with. Null until it has loaded, and `hasFailed` when
  the download did, which the page says rather than throwing to the route
*/
function useRichTextEditor() {
  const [editorModule, setEditorModule] = useState<RichTextEditorModule | null>(null)
  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    let isMounted = true

    loadRichTextEditor()
      .then(loaded => {
        if (isMounted) setEditorModule(loaded)
      })
      .catch(error => {
        console.error('The rich text editor could not load', error)

        if (isMounted) setHasFailed(true)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return {
    RichTextEditor: editorModule?.RichTextEditor ?? null,
    hasFailed,
  }
}

export default useRichTextEditor
