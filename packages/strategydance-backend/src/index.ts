import { IS_PRODUCTION, PORT } from '~constants'

import logger from '~utils/logger'

import createApp from './app'

/*
  The backend: what the browser cannot do for itself, because it needs a secret or has to happen
  on the server's word. Everything else stays between the web app and Data Connect
*/
const app = createApp()

// Express 5 hands a failed listen to the callback rather than throwing it, a taken port included
app.listen(PORT, error => {
  if (error) {
    logger.error(`Could not listen on port ${PORT}, which another process may be holding`, error)
    process.exit(1)
  }

  logger.info(`🚀 ${IS_PRODUCTION ? 'Production' : 'Development'} server on port ${PORT}`)
})
