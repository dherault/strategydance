import { useEffect, useRef } from 'react'

/*
  What a Base UI combobox's popup needs to work inside a modal Radix dialog, which traps focus,
  disables pointer events and hides from assistive technology everything outside itself, and
  dismisses on an Escape that reaches the document.

  `findPortalContainer`, the trigger's ref, finds the dialog around it, into which the popup
  portals through `portalContainerRef` rather than to the end of the body. While the popup is
  open, Escape is claimed before the dialog hears it: the dialog leaves a prevented one alone, and
  Base UI closes the popup on it all the same, so the key closes the popup and nothing else
*/
function useComboboxLayer(isOpen: boolean) {
  const portalContainerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isOpen) return

    function claimEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') event.preventDefault()
    }

    window.addEventListener('keydown', claimEscape, { capture: true })

    return () => window.removeEventListener('keydown', claimEscape, { capture: true })
  }, [isOpen])

  function findPortalContainer(trigger: HTMLElement | null) {
    portalContainerRef.current = trigger?.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ?? null
  }

  return { portalContainerRef, findPortalContainer }
}

export default useComboboxLayer
