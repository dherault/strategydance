import { describe, expect, it } from 'bun:test'

import { renderToStaticMarkup } from 'react-dom/server'
import { CompanyLogo } from 'strategydance-design-system/components/company/CompanyLogo'

describe('CompanyLogo', () => {
  it('draws the initials under the logo, which covers the square', () => {
    const markup = renderToStaticMarkup(
      <CompanyLogo
        name="Acme Robotics"
        src="https://example.com/logo.png"
      />,
    )

    expect(markup).toMatch(/>AR<img [^>]*src="https:\/\/example.com\/logo.png"/)
    expect(markup).toContain('object-cover')
  })

  it('draws the initials alone without a logo', () => {
    const markup = renderToStaticMarkup(<CompanyLogo name="Acme Robotics" />)

    expect(markup).toContain('>AR</span>')
    expect(markup).not.toContain('<img')
  })

  it('takes its name from the company, or none with an empty alt', () => {
    expect(renderToStaticMarkup(<CompanyLogo name="Acme Robotics" />)).toContain(
      'role="img" aria-label="Acme Robotics"',
    )

    const decorative = renderToStaticMarkup(
      <CompanyLogo
        name="Acme Robotics"
        alt=""
      />,
    )

    expect(decorative).toContain('aria-hidden="true"')
    expect(decorative).not.toContain('role="img"')
  })

  it('writes the initials in whatever reads on the color', () => {
    const onDark = renderToStaticMarkup(
      <CompanyLogo
        name="Acme"
        color="#0051A3"
      />,
    )
    const onLight = renderToStaticMarkup(
      <CompanyLogo
        name="Acme"
        color="#FACC15"
      />,
    )

    expect(onDark).toContain('text-white')
    expect(onDark).toContain('background-color:#0051A3')
    expect(onLight).toContain('text-neutral-950')
    expect(renderToStaticMarkup(<CompanyLogo name="Acme" />)).toContain('bg-primary text-primary-foreground')
  })
})
