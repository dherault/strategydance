import readIntegrationRefusal, { type IntegrationRefusal } from '~domain/integrations/readIntegrationRefusal'

/*
  Runs an integration's mutation, answering its refusal as an outcome a route answers, and
  throwing any other failure, which is the database's
*/
async function runIntegrationWrite(write: () => Promise<unknown>): Promise<{ outcome: IntegrationRefusal } | null> {
  try {
    await write()

    return null
  } catch (error) {
    const refusal = readIntegrationRefusal(error)

    if (refusal) return { outcome: refusal }

    throw error
  }
}

export default runIntegrationWrite
