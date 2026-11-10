import type { Directory } from 'strategydance-knowledge/src/directories/types'

// One download for every reader on the page, started by the first that asks
let modulePromise: Promise<Directory[]> | null = null

/*
  The directories open to a submission today, as the release ships strategydance-knowledge's list,
  sorted by name: fetched only once a page asks for them, so their 200 KB stay out of every other
  page's bundle. The inactive list is never loaded, since the app shows none of them (knowledge.md)
*/
function loadDirectories() {
  modulePromise ??= import('strategydance-knowledge/src/directories/directories.json')
    .then(({ default: directories }) => directories as Directory[])
    .catch(error => {
      // A later reader tries again rather than inheriting the failure
      modulePromise = null

      throw error
    })

  return modulePromise
}

export default loadDirectories
