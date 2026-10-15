import type { GetConversationRequestContextData } from 'strategydance-database/backend'

import type { ConversationProfile } from '~domain/agent/buildConversationContext'

// What a run's context message tells Claude of its member and their organization, as the request
// context reads them. A subagent's names its parent's aspects, as its parent's next run would
function toConversationProfile(data: GetConversationRequestContextData): ConversationProfile {
  return {
    memberName: data.user?.displayName ?? null,
    jobTitle: data.userOrganization?.jobTitle ?? null,
    role: data.userOrganization?.role === 'ADMINISTRATOR' ? 'ADMINISTRATOR' : 'MEMBER',
    bio: data.user?.bio ?? null,
    locale: data.user?.locale ?? 'EN',
    timezone: data.user?.timezone ?? null,
    organizationName: data.organization?.name ?? '',
    brief: data.organization?.brief ?? null,
    exploredAspects: data.organization?.exploredAspects ?? [],
    aspects: data.conversations[0]?.parent?.aspects ?? data.conversations[0]?.aspects ?? [],
  }
}

export default toConversationProfile
