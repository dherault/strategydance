import { renewConversationRunLease } from 'strategydance-database/backend'

import type { ConversationRunFence } from '~types'

import { CONVERSATION_RUN_RENEWAL_INTERVAL_MS, CONVERSATION_RUN_STEP_INTERVAL_MS } from '~constants'

import { dataConnect } from '~firebase'

import logger from '~utils/logger'

type Options = {
  fence: ConversationRunFence
  // Called once, when a renewal finds the run is no longer this worker's
  onLost: () => void
  renewalIntervalMs?: number
  stepIntervalMs?: number
}

/*
  Keeps a claimed run's lease alive for the worker that claimed it, and orders its writes.

  Every fenced write goes through `write`, one after the other, so they land in the order the
  worker made them and never beside a renewal of its own. Each of them renews the lease, so the
  timer renews it only while nothing else is queued, every 20 seconds, well within its minute. A
  progress line is written with a renewal, the latest one, at most once a second.

  A renewal that finds the run is no longer this worker's, claimed again or its author gone, calls
  `onLost`, which aborts what the worker is doing, and renews no more. One that fails otherwise is
  logged, and the next tries again. `stop` stops the timer and waits for the writes already queued
*/
function createConversationRunLease({
  fence,
  onLost,
  renewalIntervalMs = CONVERSATION_RUN_RENEWAL_INTERVAL_MS,
  stepIntervalMs = CONVERSATION_RUN_STEP_INTERVAL_MS,
}: Options) {
  let queue: Promise<unknown> = Promise.resolve()
  let pendingWrites = 0
  let isStopped = false
  let isLost = false
  // The latest progress line, until a renewal writes it
  let step: string | null = null
  let stepWrittenAt = 0
  let stepTimeout: ReturnType<typeof setTimeout> | null = null

  const renewalInterval = setInterval(() => {
    if (!isStopped && !isLost && !pendingWrites) void write(renew)
  }, renewalIntervalMs)

  function write<T>(operation: () => Promise<T>) {
    pendingWrites++

    const result = queue.then(operation).finally(() => {
      pendingWrites--
    })

    queue = result.catch(() => {})

    return result
  }

  async function renew() {
    const nextStep = step

    step = null

    if (nextStep !== null) stepWrittenAt = Date.now()

    try {
      const { data } = await renewConversationRunLease(dataConnect, {
        ...fence,
        ...(nextStep === null ? {} : { step: nextStep }),
      })

      if (data.conversationRun_updateMany !== 1) lose()
    } catch (error) {
      logger.warn(`Conversation run ${fence.runId}: its lease could not be renewed`, error)
    }
  }

  function lose() {
    if (isLost) return

    isLost = true
    clearTimers()
    onLost()
  }

  function clearTimers() {
    clearInterval(renewalInterval)

    if (stepTimeout) clearTimeout(stepTimeout)

    stepTimeout = null
  }

  function setStep(nextStep: string) {
    if (isStopped || isLost) return

    step = nextStep

    if (stepTimeout) return

    stepTimeout = setTimeout(
      () => {
        stepTimeout = null

        if (step !== null && !isStopped && !isLost) void write(renew)
      },
      Math.max(0, stepWrittenAt + stepIntervalMs - Date.now()),
    )
  }

  async function stop() {
    isStopped = true
    clearTimers()

    await queue
  }

  return { write, setStep, stop }
}

export type ConversationRunLease = ReturnType<typeof createConversationRunLease>

export default createConversationRunLease
