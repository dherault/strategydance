/*
  What a sweep throws once it has done all it could, when some of what it read or reconciled failed:
  each failure is logged where it happened, and the sweep went on past it, so this only tells the
  route, whose `runSweepSteps` reports the step failed and Cloud Scheduler records the sweep so
*/
class SweepIncomplete extends Error {
  constructor(sweep: string, failures: number) {
    super(`${sweep}: ${failures} of its reads or reconciles failed, each logged, the rest done`)

    this.name = 'SweepIncomplete'
  }
}

export default SweepIncomplete
