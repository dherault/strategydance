import { Heading, Text } from 'react-email'

import EmailButton from '../components/EmailButton'
import EmailLayout from '../components/EmailLayout'
import { PRODUCT_NAME } from '../constants'
import { heading, note, paragraph } from '../styles'

export type OrganizationInvitationEmailProps = {
  organizationName: string
  // The inviter's name, or their address when their account has none
  inviterName: string
  // The page that accepts it. Its id is the invitation's secret, so this is the only place the
  // link is written
  invitationUrl: string
}

/*
  An invitation to somebody who may never have heard of the product, from somebody they know. It
  names both before it names the product, and says that ignoring it is safe
*/
function OrganizationInvitationEmail({ organizationName, inviterName, invitationUrl }: OrganizationInvitationEmailProps) {
  return (
    <EmailLayout
      preview={`${inviterName} invited you to join ${organizationName} on ${PRODUCT_NAME}.`}
    >
      <Heading
        as="h1"
        style={heading}
      >
        {`Join ${organizationName} on ${PRODUCT_NAME}`}
      </Heading>
      <Text style={paragraph}>
        {`${inviterName} invited you to join ${organizationName} on ${PRODUCT_NAME}, where your team works through each aspect of your company together, from strategy and product to finances and sales.`}
      </Text>
      <EmailButton href={invitationUrl}>
        Accept the invitation
      </EmailButton>
      <Text style={note}>
        Not expecting this invitation? You can ignore this email. Nothing happens until you accept it.
      </Text>
    </EmailLayout>
  )
}

// Read by `bun run dev:emails`, which renders every template in this directory with these props
OrganizationInvitationEmail.PreviewProps = {
  organizationName: 'Northwind',
  inviterName: 'Astrid Lindqvist',
  invitationUrl: 'https://strategydance.com/-/invitation/2f1c9e4a8b7d4c3e9a1b6d5f0e8c7a92',
} satisfies OrganizationInvitationEmailProps

export default OrganizationInvitationEmail
