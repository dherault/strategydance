/*
  Emails Resend may or may not have taken: the request got no answer or a server error, every time
  it was sent. Set apart from a refusal, after which nothing went out, because a caller that undoes
  what an email was for, like taking back an invitation, must not when the email may have arrived
*/
class UnknownDeliveryError extends Error {
  constructor(message: string) {
    super(message)

    this.name = 'UnknownDeliveryError'
  }
}

export default UnknownDeliveryError
