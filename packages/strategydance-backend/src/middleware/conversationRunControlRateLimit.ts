import createRateLimit from '~middleware/createRateLimit'

/*
  The reconciles and the stops of conversations' runs and subagents, which start nothing, so neither
  a daily cap nor a verified address meters them, while each can ask Cloud Tasks about a run, end
  runs and promote others: 300 per caller in 10 minutes, keyed as the uploads are. A page asks a
  run's reconcile and its subagents' every two minutes while one is busy, so even a reader with every
  window of the dock open in a few tabs stays well under it
*/
const conversationRunControlRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  key: 'viewer',
  message: 'Too many reconciles or stops, try again later',
})

export default conversationRunControlRateLimitMiddleware
