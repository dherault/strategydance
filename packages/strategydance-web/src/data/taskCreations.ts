import createTabStore from '~utils/common/createTabStore'

/*
  The tasks the reader created that the server has not stored yet, by id, which a random UUID keeps
  apart across organizations. Such a task is on the board before the server has it, so its dialog
  can open at once, and it must neither read what the server holds of it, nothing yet, nor take it
  for deleted until then
*/
const creations = createTabStore(false, isBeingCreated => !isBeingCreated)

export const readIsTaskBeingCreated = creations.read

export const updateTaskCreation = creations.update

export const subscribeToTaskCreations = creations.subscribe
