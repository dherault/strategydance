import createKnowledgeDatabaseFake from '~domain/knowledge/testing/createKnowledgeDatabaseFake'
import createModuleDatabaseFakeBase from '~domain/modules/testing/createModuleDatabaseFakeBase'
import createTasksDatabaseFake from '~domain/tasks/testing/createTasksDatabaseFake'

/*
  The backend connector's operations every module uses, over tables kept in memory, for the modules'
  tests: one base with each module's tables and operations added to it, so one mock of
  `strategydance-database/backend` serves every module's server, which a module's handler loads all
  of, and their call results and memberships are one
*/
function createModuleDatabaseFake() {
  return createTasksDatabaseFake(createKnowledgeDatabaseFake(createModuleDatabaseFakeBase()))
}

export type ModuleDatabaseFake = ReturnType<typeof createModuleDatabaseFake>

export default createModuleDatabaseFake
