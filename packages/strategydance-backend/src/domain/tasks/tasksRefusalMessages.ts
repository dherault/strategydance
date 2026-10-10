/*
  Parts of the messages the Tasks module's operations give when one of their checks refuses, which the
  domain matches to say why: change each with its check in the backend connector
*/
export const FULL_REFUSAL = 'An organization keeps at most'
export const NOT_FOUND_REFUSAL = 'No task by that id in the organization'
export const ASSIGNEE_REFUSAL = 'A task is assigned to a member of its organization'
export const CHANGED_REFUSAL = 'The task changed or was deleted since it was read'
export const SELF_REFUSAL = 'A task cannot wait on itself'
export const REVERSE_REFUSAL = 'A task cannot wait on a task that waits on it'
export const LINKS_REFUSAL = 'A task waits on at most'
export const NOT_LINKED_REFUSAL = 'The task does not wait on that one'
export const GONE_REFUSAL = 'The task is gone for good'
