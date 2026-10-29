// What a subagent's write named: the document or the task its result names, with the tool that wrote
export type SubagentWrite = { tool: string; documentId?: string; taskId?: string }

/*
  The document or the task a write's result names, by the module whose tool wrote it: every result
  of the Documents and Tasks modules' writes holds the id of what it wrote. `read_subagent` and the
  reports a parent is delivered name a subagent's writes so
*/
function toSubagentWrite({ tool, result }: { tool: string; result: string }): SubagentWrite {
  const id = readResultId(result)

  if (!id) return { tool }
  if (tool.includes('document')) return { tool, documentId: id }
  if (tool.includes('task')) return { tool, taskId: id }

  return { tool }
}

function readResultId(result: string) {
  try {
    const parsed: unknown = JSON.parse(result)

    return parsed && typeof parsed === 'object' && 'id' in parsed && typeof parsed.id === 'string' ? parsed.id : null
  } catch {
    return null
  }
}

export default toSubagentWrite
