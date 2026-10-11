// Takes a conversation's reader to its latest entry: the end of the box its thread scrolls in, in a
// dock's window, or of the page
function scrollConversationToEnd(scroller: HTMLElement | null) {
  if (scroller) {
    scroller.scrollTo({ top: scroller.scrollHeight })

    return
  }

  window.scrollTo({ top: document.documentElement.scrollHeight })
}

export default scrollConversationToEnd
