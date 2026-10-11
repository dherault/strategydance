import { DOCK_MORE_WIDTH, DOCK_WINDOW_GAP, DOCK_WINDOW_WIDTH } from '~constants'

function countFitting(width: number) {
  return Math.max(1, Math.floor((width + DOCK_WINDOW_GAP) / (DOCK_WINDOW_WIDTH + DOCK_WINDOW_GAP)))
}

/*
  How many of the dock's windows it shows side by side in the width it has, the rest going behind
  the "+N" button, whose own width then counts. Always one at least, however narrow the screen
*/
function countShownDockWindows(width: number, count: number) {
  const fitting = countFitting(width)

  if (count <= fitting) return count

  return Math.min(count, countFitting(width - DOCK_MORE_WIDTH))
}

export default countShownDockWindows
