import { useEffect, useState } from 'react'

/*
  Whether the faces a field's text is drawn in have loaded, as `document.fonts.load` answers for
  the field's own font and text. A field that measures its text, as an autosizing textarea does,
  measures it in the fallback font until they have, and nothing else says when they do: WebKit
  fires none of `document.fonts`'s events for a face a stylesheet asks for, and resolves its
  `ready` while that face is still loading.

  False until there is a field, and for good if its faces fail to load, since the fallback is then
  what it draws
*/
function useFontLoaded(field: HTMLInputElement | HTMLTextAreaElement | null) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!field) return

    const { fontStyle, fontWeight, fontSize, fontFamily } = getComputedStyle(field)
    let isCurrent = true

    document.fonts
      .load(`${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`, field.value || field.placeholder || undefined)
      .then(() => {
        if (isCurrent) setIsLoaded(true)
      })
      .catch(() => undefined)

    return () => {
      isCurrent = false
    }
  }, [field])

  return isLoaded
}

export default useFontLoaded
