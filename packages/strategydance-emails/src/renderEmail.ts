import type { ReactElement } from 'react'
import { render } from 'react-email'

// html-to-text capitalizes headings by default, which in a plain-text email reads as shouting
const PLAIN_TEXT_OPTIONS = {
  selectors: [
    { selector: 'h1', options: { uppercase: false } },
  ],
}

/*
  An email's two parts. The plain-text one goes out beside the HTML rather than instead of it: a
  message with no plain-text part scores worse with spam filters, and a welcome lands in an inbox
  that has never seen us before
*/
async function renderEmail(element: ReactElement) {
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true, htmlToTextOptions: PLAIN_TEXT_OPTIONS }),
  ])

  return { html, text }
}

export default renderEmail
