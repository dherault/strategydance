/*
  Where a conversation's thread can be seen, top and bottom as the viewport measures them: the box
  it scrolls in, in a dock's window, or the window itself on the conversation's page, which scrolls
  the page rather than the thread
*/
function readConversationViewport(scroller: HTMLElement | null) {
  if (!scroller) return { top: 0, bottom: window.innerHeight }

  const { top, bottom } = scroller.getBoundingClientRect()

  return { top, bottom }
}

export default readConversationViewport
