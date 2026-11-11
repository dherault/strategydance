import createRateLimit from '~middleware/createRateLimit'

/*
  The invite route's requests, metered: 20 per caller in 10 minutes, which a person inviting their
  team never reaches and a script does. The invitations they create, which are the emails this
  server sends, are metered on their own, in the database, by `createOrganizationInvitations`.

  Keyed by the verified caller rather than the address, since one office shares an address and
  one caller can hold many. It runs after `authenticationMiddleware`, and falls back to the
  address only if it ever does not.

  Counted in the instance's memory, so a caller spread across several Cloud Run instances gets
  that many allowances. That bounds requests rather than mail, which the database count holds to
  across instances, so a shared store here waits until request volume itself matters
*/
const invitationRateLimitMiddleware = createRateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  key: 'viewer',
  message: 'Too many invitations sent, try again later',
})

export default invitationRateLimitMiddleware
