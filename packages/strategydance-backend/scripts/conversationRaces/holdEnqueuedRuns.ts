import { plugin } from 'bun'

// What `enqueueRun` is replaced by: a run sent on its way goes nowhere, and is answered as queued
const HELD_ENQUEUE_RUN = 'export default async function enqueueRun() { return true }'

/*
  Keeps every run the races start where its start left it. In development `enqueueRun` starts a run
  in the process, which would claim it and end it while the race still counts it, so the module is
  replaced before anything loads it, and a race drives a worker's steps itself where it means to.
  `mock.module` is `bun test`'s alone: a script swaps a module with a runtime plugin
*/
function holdEnqueuedRuns() {
  plugin({
    name: 'held runs',
    setup(build) {
      build.onLoad({ filter: /domain\/conversations\/enqueueRun\.ts$/ }, () => ({
        contents: HELD_ENQUEUE_RUN,
        loader: 'js',
      }))
    },
  })
}

export default holdEnqueuedRuns
