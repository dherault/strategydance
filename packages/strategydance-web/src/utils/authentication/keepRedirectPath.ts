import { REDIRECT_PATH_STORAGE_KEY } from '~constants'

/*
  Keeps the page a signed-out reader asked for, for the sign-in screen to return them to once they
  are in. In the browser's storage rather than the sign-in screen's URL, so the address reads
  `/authentication`, and a reader who comes back in another tab, from a password reset's email,
  still lands where they were going.

  A browser that refuses the write loses nothing but the return: the reader lands on Today
*/
function keepRedirectPath(path: string, now = Date.now()) {
  try {
    localStorage.setItem(REDIRECT_PATH_STORAGE_KEY, JSON.stringify({ path, keptAt: now }))
  } catch (error) {
    console.error('Failed to keep the page to return to after signing in', error)
  }
}

export default keepRedirectPath
