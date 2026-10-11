import type { z } from 'zod'

/*
  A cursor `encodeCursor` wrote, read back and checked against what it should hold, or null when it
  is not one: an agent may send anything, a cursor of another tool's or one it made up
*/
function decodeCursor<Schema extends z.ZodType>(cursor: string, schema: Schema): z.infer<Schema> | null {
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export default decodeCursor
