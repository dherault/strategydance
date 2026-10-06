import { REDIRECT_PATH_LIFETIME_MS, REDIRECT_PATH_STORAGE_KEY } from '~constants'

import parseRedirectPath from './parseRedirectPath'

/*
  The page `keepRedirectPath` kept, while it is fresh and still checks out as one of the app's own,
  or null. Reading leaves it kept: StrictMode reads it twice in development, and both reads have to
  agree on where the reader goes. `forgetRedirectPath` lets go of it once they are there
*/
function readRedirectPath(now = Date.now()) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(REDIRECT_PATH_STORAGE_KEY) ?? 'null')

    if (typeof stored !== 'object' || stored === null) return null

    const { path, keptAt } = stored as { path?: unknown; keptAt?: unknown }

    if (typeof keptAt !== 'number' || Math.abs(now - keptAt) > REDIRECT_PATH_LIFETIME_MS) return null

    return parseRedirectPath(path)
  } catch {
    return null
  }
}

export default readRedirectPath
