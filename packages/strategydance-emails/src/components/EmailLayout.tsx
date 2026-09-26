import type { CSSProperties, PropsWithChildren } from 'react'
import { Body, Column, Container, Head, Html, Img, Link, Preview, Row, Section, Text } from 'react-email'

import {
  BACKGROUND_COLOR,
  BODY_FONT_FAMILY,
  BORDER_COLOR,
  CARD_COLOR,
  HEADING_COLOR,
  HEADING_FONT_FAMILY,
  HEADING_FONT_URL,
  LOGO_SIZE,
  LOGO_URL,
  MUTED_COLOR,
  PRODUCT_NAME,
  SITE_LABEL,
  SITE_URL,
} from '../constants'

type EmailLayoutProps = PropsWithChildren<{
  // What an inbox shows after the subject, before the email is opened
  preview: string
  // Why the reader got this email, under the card
  footer: string
}>

// The one `<style>` block, and only a font face: a client that strips it falls back to the
// families on each `style` attribute, and nothing else depends on it
const FONT_FACE = `@font-face {
  font-family: Oswald;
  font-style: normal;
  font-weight: 400;
  mso-font-alt: Arial;
  src: url(${HEADING_FONT_URL}) format('woff2');
}`

const body: CSSProperties = {
  backgroundColor: BACKGROUND_COLOR,
  fontFamily: BODY_FONT_FAMILY,
  margin: 0,
  padding: '40px 16px',
}

const container: CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
}

const header: CSSProperties = {
  padding: '0 0 24px',
}

const logoColumn: CSSProperties = {
  width: `${LOGO_SIZE + 12}px`,
  verticalAlign: 'middle',
}

const logo: CSSProperties = {
  display: 'block',
}

const wordmark: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: HEADING_FONT_FAMILY,
  fontSize: '20px',
  lineHeight: `${LOGO_SIZE}px`,
  margin: 0,
}

const card: CSSProperties = {
  backgroundColor: CARD_COLOR,
  border: `1px solid ${BORDER_COLOR}`,
  borderRadius: '8px',
  padding: '40px 36px',
}

const footerSection: CSSProperties = {
  padding: '24px 36px 0',
}

const footerText: CSSProperties = {
  color: MUTED_COLOR,
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 4px',
}

const footerLink: CSSProperties = {
  color: MUTED_COLOR,
  textDecorationLine: 'underline',
}

/*
  What every email shares: the mark and the name above a white card on the app's neutral page,
  and a footer saying why the reader got it. Tables underneath, through react-email's `Section`,
  `Row` and `Column`, since Outlook lays out nothing else reliably
*/
function EmailLayout({ preview, footer, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        {/* A constant, never anything a user wrote */}
        <style dangerouslySetInnerHTML={{ __html: FONT_FACE }} />
      </Head>
      <Preview>
        {preview}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Row>
              <Column style={logoColumn}>
                {/* Decorative: the name beside it says the same when images are blocked */}
                <Img
                  alt=""
                  height={LOGO_SIZE}
                  src={LOGO_URL}
                  style={logo}
                  width={LOGO_SIZE}
                />
              </Column>
              <Column>
                <Text style={wordmark}>
                  {PRODUCT_NAME}
                </Text>
              </Column>
            </Row>
          </Section>
          <Section style={card}>
            {children}
          </Section>
          <Section style={footerSection}>
            <Text style={footerText}>
              {footer}
            </Text>
            <Text style={footerText}>
              <Link
                href={SITE_URL}
                style={footerLink}
              >
                {SITE_LABEL}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout
