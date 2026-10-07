import { IS_PRODUCTION, IS_WORKER, PORT } from '~constants'

import logger from '~utils/logger'

import createApp from './app'

/*
  The backend: what the browser cannot do for itself, because it needs a secret or has to happen
  on the server's word. Everything else stays between the web app and Data Connect.

  Or, started with `SERVICE=worker`, the worker: the same code, deployed as a second, private
  service, which runs conversations' runs as Cloud Tasks delivers them and sweeps what was deleted
  once a day, as Cloud Scheduler asks
*/
const app = createApp({ isWorker: IS_WORKER })

// Express 5 hands a failed listen to the callback rather than throwing it, a taken port included
app.listen(PORT, error => {
  if (error) {
    logger.error(`Could not listen on port ${PORT}, which another process may be holding`, error)
    process.exit(1)
  }

  logger.info(`🚀 ${IS_PRODUCTION ? 'Production' : 'Development'} ${IS_WORKER ? 'worker' : 'server'} on port ${PORT}`)
})
