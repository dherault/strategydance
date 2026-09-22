import type { Locale } from 'strategydance-core'
import * as z from 'zod'

import generateJson from './generateJson'
import getLocaleLabel from './getLocaleLabel'
import { KEY_CONCEPTS, PRODUCT_CONTEXT, PUNCTUATION_RULES } from './prompts'

export type TranslationPayloadEntry = {
  id: string
  defaultMessage: string
  description?: string
  previousTranslation?: string
}

const translationResponseSchema = z.record(z.string(), z.string().min(1))

/*
  Translates UI messages from English to the given locale.

  Every message handed here is one whose English source has changed, or one the locale has no
  translation of at all: `translations.lock.json` decides that before the call, so the model is
  never asked to reconsider a translation that is already correct. It answers with all of them
*/
export default function translateMessages(apiKey: string, locale: Locale, messages: TranslationPayloadEntry[]): Promise<Record<string, string>> {
  const lowercaseLocale = locale.toLowerCase()
  const prompt = `
# Instructions
Translate the following UI messages from English to locale "${lowercaseLocale}" (${getLocaleLabel(locale)}).
Use the "description" to disambiguate meaning.
Keep placeholders exactly unchanged (examples: {email}, {year}, {brand}, {count}).

A "previousTranslation" is the translation of an OLDER version of the English message, so it may be outdated or
wrong. Use it for terminology and tone continuity with the rest of the UI, but translate the current
"defaultMessage" exactly as it stands: where the two disagree, the English wins.

If you encounter a message with a tag, for example "Meet the <gradient>team</gradient>", do not translate the tag itself. Keep it as "<gradient>" and "</gradient>".
If the translation prepends a "'" before the tag, double it to "''" to escape it, for example "Rencontrez l''<gradient>équipe</gradient>".

Some messages are punctuation, a placeholder or a proper noun and have no natural translation, for example
"+{count}", "#{channelName}", "@channel" or "Google". Return those unchanged rather than inventing a translation.

# Output Format
Return a JSON object mapping the message "id" to the translated string.
Include an entry for EVERY message you were given, and no others.

# Tone and Style
Use a tone and style appropriate for a modern web application user interface.
Be concise, clear, and natural in the target language.
Maintain any formality or informality implied by the English messages.

# Punctuation
${PUNCTUATION_RULES}

# Context
${PRODUCT_CONTEXT}
${KEY_CONCEPTS ? `\n# Key Concepts\n${KEY_CONCEPTS}\n` : ''}
# Messages
${JSON.stringify(messages, null, 2)}`

  return generateJson(apiKey, prompt, translationResponseSchema)
}
