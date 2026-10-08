type Options = {
  // The run's own signal, which its worker aborts once the run is no longer its own
  signal: AbortSignal
  // When the request's stream is cut, as a time in milliseconds
  deadline: number
}

/*
  The signal a request to Claude streams under: aborted with the run's own, and cut once the run
  reaches its deadline, which `reason` then says, so the worker can tell a run it lost from a request
  it cut. `dispose` lets go of the run's signal and the timer once the stream has ended
*/
function createConversationRequestSignal({ signal, deadline }: Options) {
  const controller = new AbortController()
  let reason: 'deadline' | null = null

  function abortWithRun() {
    controller.abort(signal.reason)
  }

  const timer = setTimeout(
    () => {
      if (controller.signal.aborted) return

      reason = 'deadline'
      controller.abort(new Error('The run reached its deadline'))
    },
    Math.max(0, deadline - Date.now()),
  )

  if (signal.aborted) abortWithRun()
  else signal.addEventListener('abort', abortWithRun, { once: true })

  return {
    signal: controller.signal,
    readReason: () => reason,
    dispose() {
      clearTimeout(timer)
      signal.removeEventListener('abort', abortWithRun)
    },
  }
}

export default createConversationRequestSignal
