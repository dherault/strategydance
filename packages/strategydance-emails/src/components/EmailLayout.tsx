import type { CSSProperties, PropsWithChildren } from 'react'
import { Body, Column, Container, Head, Html, Preview, Row, Section, Text } from 'react-email'
import { Logo } from 'strategydance-design-system/components/brand/Logo'

import {
  BACKGROUND_COLOR,
  BODY_FONT_FAMILY,
  BORDER_COLOR,
  CARD_COLOR,
  HEADING_COLOR,
  HEADING_FONT_FAMILY,
  HEADING_FONT_URL,
  LOGO_SIZE,
  PRODUCT_NAME,
} from '../constants'

type EmailLayoutProps = PropsWithChildren<{
  // What an inbox shows after the subject, before the email is opened
  preview: string
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

/*
  What every email shares: the mark and the name above a white card on the app's neutral page.
  Tables underneath, through react-email's `Section`, `Row` and `Column`, since Outlook lays out
  nothing else reliably.

  The mark is the design system's own `Logo`, inline, in the secondary it takes on a light surface
  in the app. Apple Mail and iOS draw it; Gmail and Outlook drop inline SVG, and the name beside it
  is what they show
*/
function EmailLayout({ preview, children }: EmailLayoutProps) {
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
                {/* Decorative: the name beside it says the same */}
                <Logo
                  fill={HEADING_COLOR}
                  height={LOGO_SIZE}
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
        </Container>
      </Body>
    </Html>
  )
}

export default EmailLayout
