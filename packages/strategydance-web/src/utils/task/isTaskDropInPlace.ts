// Whether dropping a card before `beforeId`, or past the last card for null, leaves it where it sits
// among the cards a column shows: before itself, or before the card that follows it. A card the
// column does not show, dragged in from another, always moves
function isTaskDropInPlace(shownIds: readonly string[], taskId: string, beforeId: string | null) {
  const index = shownIds.indexOf(taskId)

  return index >= 0 && (beforeId === taskId || beforeId === (shownIds[index + 1] ?? null))
}

export default isTaskDropInPlace
