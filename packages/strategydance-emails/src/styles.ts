import type { CSSProperties } from 'react'

import { HEADING_COLOR, HEADING_FONT_FAMILY, MUTED_COLOR, PRIMARY_COLOR, TEXT_COLOR } from './constants'

/*
  The styles the templates share, as inline style objects: Gmail and Outlook strip `<style>`
  blocks, so a rule that is not on a `style` attribute is a rule that does not exist on delivery
*/

export const heading: CSSProperties = {
  color: HEADING_COLOR,
  fontFamily: HEADING_FONT_FAMILY,
  fontSize: '30px',
  fontWeight: 400,
  letterSpacing: '-0.5px',
  lineHeight: '38px',
  margin: '0 0 24px',
}

export const paragraph: CSSProperties = {
  color: TEXT_COLOR,
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}

export const note: CSSProperties = {
  color: MUTED_COLOR,
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
}

export const link: CSSProperties = {
  color: PRIMARY_COLOR,
  textDecorationLine: 'underline',
}
