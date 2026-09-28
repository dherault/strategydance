import { PRODUCTION_APP_URL } from 'strategydance-core'

/* ---
  BRAND
--- */

export const PRODUCT_NAME = 'Strategy Dance'

// The name every email goes out under: a person, since the address is David's own and a reply lands there
export const SENDER_NAME = `David from ${PRODUCT_NAME}`

/*
  Hotlinked rather than inlined: Gmail and Outlook render neither an inline SVG nor a `data:` URI,
  so the only mark that survives every client is a PNG at an absolute URL. This one is
  `packages/strategydance-web/public/assets/images/logo/logo-secondary-512.png`, the secondary the
  mark takes on a light surface in the app, which Hosting serves from the production domain
  whatever environment sent the email, since a recipient cannot reach localhost
*/
export const LOGO_URL = `${PRODUCTION_APP_URL}/assets/images/logo/logo-secondary-512.png`

// The mark's width and height in the header. The PNG is square, and 512 pixels so it stays sharp
// on a high-density screen
export const LOGO_SIZE = 32

/* ---
  PALETTE

  The design system's tokens, as literals. A client strips `<style>` blocks and knows no CSS
  variable, so every colour here has to survive on a `style` attribute
--- */

// primary-700, the design system's `--primary`
export const PRIMARY_COLOR = '#0051a3'

// secondary-900, what the design system colours headings with
export const HEADING_COLOR = '#142a41'

// neutral-800, the design system's `--foreground`
export const TEXT_COLOR = '#262626'

// neutral-500, the design system's `--muted-foreground`
export const MUTED_COLOR = '#737373'

// neutral-200, the design system's `--border`
export const BORDER_COLOR = '#e5e5e5'

// neutral-50, the design system's `--background`
export const BACKGROUND_COLOR = '#fafafa'

export const CARD_COLOR = '#ffffff'

/* ---
  TYPOGRAPHY
--- */

export const BODY_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'

/*
  Oswald, the design system's display face, where the client loads web fonts: Apple Mail and iOS
  do, Gmail and Outlook do not and fall back. `EmailLayout` declares the face itself rather than
  through react-email's `Font`, which also sets every element's family to it
*/
export const HEADING_FONT_FAMILY = 'Oswald, "Arial Narrow", Arial, sans-serif'

// Google Fonts' Latin subset of Oswald 400, the one weight headings use
export const HEADING_FONT_URL = 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiZSSUhiCXAA.woff2'
