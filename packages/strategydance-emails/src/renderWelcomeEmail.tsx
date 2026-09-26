import { PRODUCT_NAME } from './constants'
import WelcomeEmail, { type WelcomeEmailProps } from './emails/WelcomeEmail'
import renderEmail from './renderEmail'

/*
  The package's whole contract, one function per email: props in, strings out. It owns no key and
  opens no socket, which keeps the delivery provider and its secret on the backend's side.

  The sender's name is the email's to choose, since it is part of how the email reads; the
  address it goes out from is the backend's
*/
async function renderWelcomeEmail(props: WelcomeEmailProps) {
  return {
    senderName: 'David Hérault',
    subject: `Welcome to ${PRODUCT_NAME}`,
    ...await renderEmail(<WelcomeEmail {...props} />),
  }
}

export default renderWelcomeEmail
