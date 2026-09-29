/*
  Whose log the build in public cards show: the author picked while they still have entries, else
  the reader when they have some, else the first author, else nobody
*/
function pickLogAuthor(pickedId: string | null, authorIds: string[], viewerId: string | null) {
  if (pickedId && authorIds.includes(pickedId)) return pickedId
  if (viewerId && authorIds.includes(viewerId)) return viewerId

  return authorIds[0] ?? null
}

export default pickLogAuthor
