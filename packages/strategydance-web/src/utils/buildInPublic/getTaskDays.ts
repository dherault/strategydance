import getDaysBetween from '~utils/date/getDaysBetween'

/*
  The Task focus card's number, from the day a task was added: for a done task, the days it took
  to the day it was done, and for any other, the days it has been on the board. At least one, so a
  task added and done the same day took a day
*/
function getTaskDays(createdDate: string, doneDate: string | null, today: string) {
  return Math.max(1, getDaysBetween(createdDate, doneDate ?? today))
}

export default getTaskDays
