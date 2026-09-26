import type { CSSProperties, PropsWithChildren } from 'react'
import { Button, Link, Section, Text } from 'react-email'

import { PRIMARY_COLOR } from '../constants'
import { link, note } from '../styles'

type EmailButtonProps = PropsWithChildren<{
  href: string
}>

const section: CSSProperties = {
  margin: '8px 0 24px',
}

// The design system's primary button: its colour, and the near-square corners of `rounded-xs`
const button: CSSProperties = {
  backgroundColor: PRIMARY_COLOR,
  borderRadius: '2px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 500,
  lineHeight: '20px',
  padding: '14px 24px',
  textDecorationLine: 'none',
}

const fallback: CSSProperties = {
  ...note,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '16px 0 0',
}

// A long link breaks anywhere rather than widening the card past a phone's screen
const fallbackLink: CSSProperties = {
  ...link,
  wordBreak: 'break-all',
}

/*
  The email's one call to action, with its link written out under it for a client that renders
  the button as nothing clickable. The plain-text part skips that line: the button already reads
  as its label and its link there
*/
function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Section style={section}>
      <Button
        href={href}
        style={button}
      >
        {children}
      </Button>
      <Text
        data-skip-in-text
        style={fallback}
      >
        Or paste this link into your browser:
        <br />
        <Link
          href={href}
          style={fallbackLink}
        >
          {href}
        </Link>
      </Text>
    </Section>
  )
}

export default EmailButton
