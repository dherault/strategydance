import logger from '~utils/logger'

type Options = {
  // The run's own signal, which its worker aborts once the run is no longer its own
  signal: AbortSignal
  // When the request's stream is cut, as a time in milliseconds
  deadline: number
  // Whether the run's member asked to stop it, read every `stopCheckIntervalMs`
  isStopRequested: () => Promise<boolean>
  stopCheckIntervalMs: number
}

/*
  The signal a request to Claude streams under: aborted with the run's own, cut once the run reaches
  its deadline, and stopped once its member asks, which `readReason` then says, so the worker can
  tell a run it lost from a request it cut or stopped. A read of the stop flag that fails is logged,
  and the next one tries again. `dispose` lets go of the run's signal and the timers once the stream
  has ended
*/
function createConversationRequestSignal({ signal, deadline, isStopRequested, stopCheckIntervalMs }: Options) {
  const controller = new AbortController()
  let reason: 'deadline' | 'stopped' | null = null
  let isReading = false

  function abortWithRun() {
    controller.abort(signal.reason)
  }

  function cut(nextReason: 'deadline' | 'stopped', message: string) {
    if (controller.signal.aborted) return

    reason = nextReason
    controller.abort(new Error(message))
  }

  const deadlineTimer = setTimeout(
    () => cut('deadline', 'The run reached its deadline'),
    Math.max(0, deadline - Date.now()),
  )
  const stopTimer = setInterval(async () => {
    if (isReading || controller.signal.aborted) return

    isReading = true

    try {
      if (await isStopRequested()) cut('stopped', 'The run’s member asked to stop it')
    } catch (error) {
      logger.warn('Whether a run was asked to stop could not be read', error)
    } finally {
      isReading = false
    }
  }, stopCheckIntervalMs)

  if (signal.aborted) abortWithRun()
  else signal.addEventListener('abort', abortWithRun, { once: true })

  return {
    signal: controller.signal,
    readReason: () => reason,
    dispose() {
      clearTimeout(deadlineTimer)
      clearInterval(stopTimer)
      signal.removeEventListener('abort', abortWithRun)
    },
  }
}

export default createConversationRequestSignal
