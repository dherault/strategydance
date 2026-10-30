/*
  A proven way to think a company's question through, written so an agent can apply it: when to
  reach for it, what it must know first, what it asks the team, and what comes out
*/
export type StrategicFramework = {
  // A slug of the name the framework was first given, which never changes, even when the name does,
  // so whatever refers to it keeps finding it
  id: string
  name: string
  // What the framework is, in one sentence
  description: string
  // The situation it helps with, which tells an agent when to reach for it
  whenToUse: string
  // What it needs to know of the company before it can be applied
  inputs: string[]
  // What it asks the team, each a question an agent can put to them as it is
  questions: string[]
  // What applying it produces, such as a decision, a plan or a document
  output: string
}
