import { REDIRECT_PATH_STORAGE_KEY } from '~constants'

// Lets go of the page `keepRedirectPath` kept, once the reader has made it into the app
function forgetRedirectPath() {
  try {
    localStorage.removeItem(REDIRECT_PATH_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to forget the page to return to after signing in', error)
  }
}

export default forgetRedirectPath
