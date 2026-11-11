import directoriesUrl from 'strategydance-knowledge/src/directories/directories.json?url'
import type { Directory } from 'strategydance-knowledge/src/directories/types'

/*
  The directories open to a submission today, as the release ships strategydance-knowledge's list,
  sorted by name: fetched only once a page asks for them, as a hashed asset Hosting caches for a
  year, so their 200 KB stay out of every bundle. A fetch rather than a dynamic import, since a
  browser keeps a module's failed import and answers every later one with it, so no retry would ever
  load them. The inactive list is never loaded, since the app shows none of them (knowledge.md)
*/
async function loadDirectories() {
  const response = await fetch(directoriesUrl)

  if (!response.ok) throw new Error(`The directories answered ${response.status}`)

  return (await response.json()) as Directory[]
}

export default loadDirectories
