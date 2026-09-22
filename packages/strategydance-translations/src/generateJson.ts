import { FinishReason, GoogleGenAI } from '@google/genai'
import * as z from 'zod'

import { AI_MODEL } from './constants'

// A response that stopped for any other reason is a partial one. Caught here rather than at the
// call sites because a truncated JSON object is not always invalid JSON, and the translation lock
// would then record it as done
const ACCEPTED_FINISH_REASONS: (FinishReason | undefined)[] = [
  undefined,
  FinishReason.STOP,
  FinishReason.FINISH_REASON_UNSPECIFIED,
]

export default async function generateJson<Schema extends z.ZodType>(apiKey: string, prompt: string, schema: Schema): Promise<z.infer<Schema>> {
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(schema),
    },
  })

  const { finishReason } = response.candidates?.[0] ?? {}

  if (!ACCEPTED_FINISH_REASONS.includes(finishReason)) {
    throw new Error(`The translation model stopped early (${finishReason}), so its response is incomplete`)
  }

  const { text } = response

  if (!text) {
    throw new Error('No response text received from the translation model')
  }

  return schema.parse(JSON.parse(text)) as z.infer<Schema>
}
