/*
  What a subagent's last request carries after its turn's tool results, in the entry that sends
  them: its fourth run's 25th request, after which nothing more is sent. It asks for the report now,
  calling no tool, so work its limits cut off still ends with one, and its run completes when it
  does. It is stored in the transcript with the results, so a replay sends the bytes it was sent as
*/
const SUBAGENT_REPORT_REQUEST =
  'You have one request left, this one, and no tool call after it can run. Write your report now, as this reply, without calling any tool: what you did, what you found and what you changed, linking each document and task, and, where you could not finish, what is left and what you need.'

export default SUBAGENT_REPORT_REQUEST
