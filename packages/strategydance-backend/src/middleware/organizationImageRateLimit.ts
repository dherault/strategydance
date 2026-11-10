import createRateLimit from '~middleware/createRateLimit'

/*
  The organization picture routes' requests, metered: 30 per caller in 10 minutes, uploads and
  removals together, which somebody trying logos never reaches and a script filling the bucket
  does.

  Keyed by the verified caller, as `invitationRateLimitMiddleware` is and for the same reasons, and
  counted in the instance's memory the same way
*/
const organizationImageRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  key: 'viewer',
  message: 'Too many pictures changed, try again later',
})

export default organizationImageRateLimitMiddleware
