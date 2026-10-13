import type { ConversationDockWindow } from '~types'

/*
  The windows the dock lets go of to keep `max`, newest first as it holds them: the ones opened
  longest ago, but never the newest, and never one `isHeld` says must stay, as a draft whose first
  message is on its way, which nothing else would let the reader see fail. Should every older window
  be held, the dock keeps one more than `max` for a while rather than lose one
*/
function pushOutDockWindows(
  windows: readonly ConversationDockWindow[],
  max: number,
  isHeld: (dockWindow: ConversationDockWindow) => boolean,
) {
  const pushedOut: ConversationDockWindow[] = []

  for (let index = windows.length - 1; index > 0 && windows.length - pushedOut.length > max; index--) {
    const dockWindow = windows[index]!

    if (!isHeld(dockWindow)) pushedOut.push(dockWindow)
  }

  return pushedOut
}

export default pushOutDockWindows
