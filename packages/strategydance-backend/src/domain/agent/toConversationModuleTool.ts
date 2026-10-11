import type { BetaTool } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { Tool } from '@modelcontextprotocol/client'

// The bounds a strict tool's schema refuses. The module's own schema still holds a call to them, and
// a call past one is answered with a sentence the model can act on
const DROPPED_KEYWORDS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'maxItems',
])

// The keywords whose value is a schema, or a list or a map of schemas, which the conversion follows
const SCHEMA_KEYWORDS = new Set(['items'])
const SCHEMA_LIST_KEYWORDS = new Set(['anyOf', 'allOf'])
const SCHEMA_MAP_KEYWORDS = new Set(['properties', '$defs', 'definitions'])

// The keywords a strict schema takes as they are
const KEPT_KEYWORDS = new Set([
  'type',
  'description',
  'title',
  'enum',
  'const',
  'pattern',
  'format',
  'required',
  'default',
  '$ref',
])

// The string formats a strict schema takes
const FORMATS = new Set(['date-time', 'time', 'date', 'duration', 'email', 'hostname', 'uri', 'ipv4', 'ipv6', 'uuid'])

type Schema = Record<string, unknown>

/*
  A module's tool as Claude takes one in the agent's requests: its name, its description and its
  input schema, strict and streamed as Claude writes it, as the agent's own tools are. A strict
  schema takes no bound on a text's length, a number's range or a list's size past one item, so
  those are dropped, and every object refuses properties it does not name. Anything else a strict
  schema refuses throws, so a module's schema that would cost every request a 400 fails its test
  instead
*/
function toConversationModuleTool(tool: Tool): BetaTool {
  return {
    name: tool.name,
    description: tool.description ?? '',
    input_schema: toStrictSchema(tool.inputSchema, tool.name) as BetaTool['input_schema'],
    strict: true,
    eager_input_streaming: true,
  }
}

// A schema as a strict tool takes it, its keywords in the order the module wrote them
function toStrictSchema(value: unknown, path: string): Schema {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} is not a schema`)
  }

  const schema: Schema = {}

  for (const [keyword, item] of Object.entries(value)) {
    if (DROPPED_KEYWORDS.has(keyword)) continue

    if (keyword === 'minItems') {
      // A list of at least one item is the one bound a strict schema takes
      if (item === 0 || item === 1) schema[keyword] = item

      continue
    }

    if (keyword === 'additionalProperties') {
      if (item !== false) throw new Error(`${path} takes properties it does not name, which a strict tool refuses`)

      continue
    }

    if (keyword === 'format' && !FORMATS.has(String(item))) {
      throw new Error(`${path} has the format ${String(item)}, which a strict tool refuses`)
    }

    if (SCHEMA_KEYWORDS.has(keyword)) {
      schema[keyword] = toStrictSchema(item, `${path}.${keyword}`)
    } else if (SCHEMA_LIST_KEYWORDS.has(keyword)) {
      schema[keyword] = (item as unknown[]).map((entry, index) => toStrictSchema(entry, `${path}.${keyword}[${index}]`))
    } else if (SCHEMA_MAP_KEYWORDS.has(keyword)) {
      schema[keyword] = Object.fromEntries(
        Object.entries(item as Schema).map(([name, entry]) => [name, toStrictSchema(entry, `${path}.${name}`)]),
      )
    } else if (KEPT_KEYWORDS.has(keyword)) {
      schema[keyword] = item
    } else {
      throw new Error(`${path} has the keyword ${keyword}, which a strict tool refuses`)
    }
  }

  if (schema.type === 'object' || 'properties' in schema) schema.additionalProperties = false

  return schema
}

export default toConversationModuleTool
