import type { CSSProperties } from 'react'
import { Heading, Text } from 'react-email'

import EmailButton from '../components/EmailButton'
import EmailLayout from '../components/EmailLayout'
import { PRODUCT_NAME } from '../constants'
import { heading, paragraph } from '../styles'

export type WelcomeEmailProps = {
  // Null for an account with no name, which is every password sign-up
  firstName: string | null
  // Where the button leads: the app, in whichever environment sent the email
  appUrl: string
}

// Three lines of one block rather than three blocks, so no client's paragraph spacing can open a
// gap inside the signature
const signature: CSSProperties = {
  ...paragraph,
  margin: '24px 0 0',
}

/*
  A note from David rather than a product tour: it is sent from his address, and the point of it
  is the reply it asks for
*/
function WelcomeEmail({ firstName, appUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout
      footer={`You received this email because you signed up for ${PRODUCT_NAME}.`}
      preview="Thank you for signing up. Here is where to start, and how to reach me."
    >
      <Heading
        as="h1"
        style={heading}
      >
        {`Welcome to ${PRODUCT_NAME}`}
      </Heading>
      <Text style={paragraph}>
        {firstName ? `Hi ${firstName},` : 'Hi,'}
      </Text>
      <Text style={paragraph}>
        {`Thank you for signing up. I'm David, and I build ${PRODUCT_NAME}.`}
      </Text>
      <Text style={paragraph}>
        {`${PRODUCT_NAME} walks your company through each of its aspects, from strategy and product to finances and sales. Start with the one that matters most to you right now, and bring your team in when you are ready.`}
      </Text>
      <EmailButton href={appUrl}>
        {`Open ${PRODUCT_NAME}`}
      </EmailButton>
      <Text style={paragraph}>
        It is early days, so I would love to hear from you: what brought you here, what you hope it does for your company, and anything that feels off. Reply to this email, it comes straight to me.
      </Text>
      <Text style={signature}>
        Best,
        <br />
        <strong>
          David Hérault
        </strong>
        <br />
        {PRODUCT_NAME}
      </Text>
    </EmailLayout>
  )
}

// Read by `bun run dev:emails`, which renders every template in this directory with these props
WelcomeEmail.PreviewProps = {
  firstName: 'Astrid',
  appUrl: 'https://strategydance.com',
} satisfies WelcomeEmailProps

export default WelcomeEmail
