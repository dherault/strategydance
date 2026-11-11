import type { NextFunction, Request, Response } from 'express'

/*
  No browser or proxy keeps what a route answers: the token and revocation endpoints, a refusal
  included (RFC 6749, 5.1), and the callback an integration's sign-in comes back through, whose
  address carries its code, its rate limit's answer saying so itself. `Pragma` for the HTTP/1.0
  caches the RFC names
*/
function noStoreMiddleware(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Pragma', 'no-cache')
  next()
}

export default noStoreMiddleware
