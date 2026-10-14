import type { IntegrationAvailability } from '~domain/integrations/readIntegrationAvailability'

type Unavailability = Exclude<IntegrationAvailability, { outcome: 'available' }>['outcome']

// Why a server does not work for the member, as a sentence the agent can act on: what to tell them
function describeIntegrationUnavailability(name: string, outcome: Unavailability) {
  switch (outcome) {
    case 'off':
      return `${name} is turned off. Tell the member an administrator can turn it on from the Integrations page.`
    case 'notConnected':
      return `The member has not connected their account to ${name}. Tell them to connect it from the Integrations page, then ask again.`
    case 'needsAuthentication':
      return `The member's connection to ${name} needs them to connect again. Tell them to reconnect it from the Integrations page.`
    case 'keyMissing':
      return `${name} has no key. Tell the member an administrator can set one from the Integrations page.`
    case 'toolsNotListed':
      return `${name}'s tools have not been listed yet. Tell the member an administrator can list them with Retry on the Integrations page.`
  }
}

export default describeIntegrationUnavailability
