import type { NextFunction, Request, Response } from 'express'

// Headers for an API that only ever answers JSON: nothing it sends is meant to be framed,
// sniffed into another type or followed by a referrer
function securityMiddleware(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  response.setHeader('Referrer-Policy', 'no-referrer')

  next()
}

export default securityMiddleware
