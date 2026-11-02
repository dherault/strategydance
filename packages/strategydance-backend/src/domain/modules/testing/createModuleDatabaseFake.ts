import createBudgetDatabaseFake from '~domain/budget/testing/createBudgetDatabaseFake'
import createDocumentsDatabaseFake from '~domain/documents/testing/createDocumentsDatabaseFake'
import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'
import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createOAuthDatabaseFake from '~domain/oauth/testing/createOAuthDatabaseFake'
import createTasksDatabaseFake from '~domain/tasks/testing/createTasksDatabaseFake'

/*
  The backend connector's operations every module uses, over tables kept in memory, for the modules'
  tests: one base with each module's tables and operations added to it, the Knowledge module's after
  the Documents and Tasks modules' whose rows its links read, so one mock of
  `strategydance-database/backend` serves every module's server, which a module's handler loads all
  of, and their call results and memberships are one. The authorization server's join them, so an
  external agent's token is verified against the memberships its calls are
*/
function createModuleDatabaseFake() {
  return createOAuthDatabaseFake(
    createKnowledgeDatabaseFake(
      createBudgetDatabaseFake(createTasksDatabaseFake(createDocumentsDatabaseFake(createModuleDatabaseFakeBase()))),
    ),
  )
}

export type ModuleDatabaseFake = ReturnType<typeof createModuleDatabaseFake>

export default createModuleDatabaseFake
