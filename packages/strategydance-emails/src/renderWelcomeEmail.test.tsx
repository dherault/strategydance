import { describe, expect, test } from 'bun:test'

import renderWelcomeEmail from './renderWelcomeEmail'

// Development's, so it stands apart from the production site the logo is served from
const APP_URL = 'http://localhost:5173'

describe('renderWelcomeEmail', () => {
  test('greets the reader by name and links to the app, in both parts', async () => {
    const { subject, html, text } = await renderWelcomeEmail({ firstName: 'Astrid', appUrl: APP_URL })

    expect(subject).toBe('Welcome to Strategy Dance')
    expect(html).toContain('Hi Astrid,')
    expect(html).toContain(`href="${APP_URL}"`)
    expect(text).toContain('Hi Astrid,')
    expect(text).toContain(APP_URL)
  })

  test('greets a reader with no name without one', async () => {
    const { html, text } = await renderWelcomeEmail({ firstName: null, appUrl: APP_URL })

    expect(html).toContain('Hi,')
    expect(text).toContain('Hi,')
  })

  test('escapes a name that holds markup', async () => {
    const { html } = await renderWelcomeEmail({ firstName: '<b>Astrid</b>', appUrl: APP_URL })

    expect(html).not.toContain('<b>Astrid</b>')
    expect(html).toContain('&lt;b&gt;Astrid&lt;/b&gt;')
  })

  test('draws the mark as a PNG from the production site, whatever environment sent the email', async () => {
    const { html } = await renderWelcomeEmail({ firstName: 'Astrid', appUrl: APP_URL })

    expect(html).toContain('src="https://strategydance.com/assets/images/logo/logo-secondary-512.png"')
    // Gmail and Outlook drop inline SVG
    expect(html).not.toContain('<svg')
  })

  test('leaves the fallback link out of the plain-text part, where the button already carries it', async () => {
    const { text } = await renderWelcomeEmail({ firstName: 'Astrid', appUrl: APP_URL })

    expect(text).not.toContain('Or paste this link')
    expect(text.split(APP_URL).length - 1).toBe(1)
  })
})
