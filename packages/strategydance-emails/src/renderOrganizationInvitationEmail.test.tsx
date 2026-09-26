import { describe, expect, test } from 'bun:test'

import renderOrganizationInvitationEmail from './renderOrganizationInvitationEmail'

const INVITATION_URL = 'http://localhost:5173/-/invitation/2f1c9e4a8b7d4c3e9a1b6d5f0e8c7a92'

describe('renderOrganizationInvitationEmail', () => {
  test('names the inviter and the organization, and links to the invitation in both parts', async () => {
    const { senderName, subject, html, text } = await renderOrganizationInvitationEmail({
      organizationName: 'Northwind',
      inviterName: 'Astrid Lindqvist',
      invitationUrl: INVITATION_URL,
    })

    expect(senderName).toBe('Strategy Dance')
    expect(subject).toBe('Astrid Lindqvist invited you to join Northwind on Strategy Dance')
    expect(html).toContain('Join Northwind on Strategy Dance')
    expect(html).toContain(`href="${INVITATION_URL}"`)
    expect(text).toContain('Astrid Lindqvist invited you to join Northwind')
    expect(text).toContain(INVITATION_URL)
  })

  test('escapes names that hold markup', async () => {
    const { html } = await renderOrganizationInvitationEmail({
      organizationName: '<a href="https://example.com">Northwind</a>',
      inviterName: '<img src=x>',
      invitationUrl: INVITATION_URL,
    })

    expect(html).not.toContain('<a href="https://example.com">')
    expect(html).not.toContain('<img src=x>')
    expect(html).toContain('&lt;img src=x&gt;')
  })
})
