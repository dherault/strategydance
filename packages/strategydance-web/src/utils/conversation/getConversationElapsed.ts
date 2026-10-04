/*
  How long a run has gone, as the thinking indicator shows it: minutes and seconds, or nothing from
  an hour on, as the design has it. A clock behind the server's counts from zero
*/
function getConversationElapsed(milliseconds: number) {
  const elapsed = Math.max(0, Math.floor(milliseconds / 1000))

  if (elapsed >= 60 * 60) return null

  return { minutes: Math.floor(elapsed / 60), seconds: elapsed % 60 }
}

export default getConversationElapsed
