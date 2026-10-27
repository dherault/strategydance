/*
  What a promise answers, unless a signal is aborted first, its time up or its work lost, when it
  rejects with the signal's reason and what the promise answers later is dropped: for work that
  takes no signal of its own, as a tool's call or a read from Storage
*/
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason)

    if (signal.aborted) {
      abort()

      return
    }

    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export default untilAborted
