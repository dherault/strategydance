import { useEffect } from 'react'

/*
  While active, Escape is claimed for whatever is being edited, which handles it itself, rather
  than closing the dialog around it. A modal Radix dialog dismisses on an Escape that reaches the
  document, which it hears before the field does, and leaves a prevented one alone: so the key is
  prevented on the window, first, and still reaches the field
*/
function useClaimEscape(isActive: boolean) {
  useEffect(() => {
    if (!isActive) return

    function claimEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') event.preventDefault()
    }

    window.addEventListener('keydown', claimEscape, { capture: true })

    return () => window.removeEventListener('keydown', claimEscape, { capture: true })
  }, [isActive])
}

export default useClaimEscape
