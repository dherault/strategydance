import { defineMessages } from 'react-intl'

// The prologue, where somebody who belongs to no organization yet creates their company
const onboardingMessages = defineMessages({
  prologueTitle: {
    id: 'onboarding.prologueTitle',
    defaultMessage: 'Prologue',
    description: 'Large title of the first screen a new user sees, before they create their company. As in the opening section of a story.',
  },
  prologueQuestion: {
    id: 'onboarding.prologueQuestion',
    defaultMessage: 'So, you want to start a company?',
    description: 'First line under the "Prologue" title, speaking to a new user.',
  },
  prologueLead: {
    id: 'onboarding.prologueLead',
    defaultMessage: 'Let\'s see how well you know the road ahead.',
    description: 'Second line under the "Prologue" title, announcing a short quiz about starting a company.',
  },
  questionCount: {
    id: 'onboarding.questionCount',
    defaultMessage: 'Question {index} of {count}',
    description: 'Small label above a quiz question, such as "Question 1 of 2".',
  },
  workQuestion: {
    id: 'onboarding.workQuestion',
    defaultMessage: 'How much work does starting a company require?',
    description: 'A quiz question asked to a new user before they create their company.',
  },
  workAnswerSome: {
    id: 'onboarding.workAnswerSome',
    defaultMessage: 'Some work',
    description: 'The wrong answer to "How much work does starting a company require?".',
  },
  workAnswerEnormous: {
    id: 'onboarding.workAnswerEnormous',
    defaultMessage: 'An enormous amount of work',
    description: 'The right answer to "How much work does starting a company require?".',
  },
  timeQuestion: {
    id: 'onboarding.timeQuestion',
    defaultMessage: 'How long does it take for a new company to take off?',
    description: 'A quiz question asked to a new user before they create their company.',
  },
  timeAnswerWeeks: {
    id: 'onboarding.timeAnswerWeeks',
    defaultMessage: 'Weeks',
    description: 'The wrong answer to "How long does it take for a new company to take off?".',
  },
  timeAnswerYears: {
    id: 'onboarding.timeAnswerYears',
    defaultMessage: 'Years',
    description: 'The right answer to "How long does it take for a new company to take off?".',
  },
  title: {
    id: 'onboarding.title',
    defaultMessage: 'With that covered, let\'s begin.',
    description: 'Title of the screen where a new user creates their company, after the quiz.',
  },
  lead: {
    id: 'onboarding.lead',
    defaultMessage: 'Strategy Dance can guide you, but the work is yours.',
    description: 'Line under the title of the screen where a new user creates their company. Strategy Dance is the product name and stays untranslated.',
  },
  nameLabel: {
    id: 'onboarding.nameLabel',
    defaultMessage: 'Company name',
    description: 'Label of the field for the name of the company a new user creates.',
  },
  namePlaceholder: {
    id: 'onboarding.namePlaceholder',
    defaultMessage: 'Acme',
    description: 'Placeholder in the empty company name field. A made-up company name, which may stay as it is.',
  },
  nameRequired: {
    id: 'onboarding.nameRequired',
    defaultMessage: 'Enter a company name',
    description: 'Error under the company name field when it was left empty.',
  },
  briefLabel: {
    id: 'onboarding.briefLabel',
    defaultMessage: 'Brief',
    description: 'Label of the field for a short description of the company a new user creates.',
  },
  briefPlaceholder: {
    id: 'onboarding.briefPlaceholder',
    defaultMessage: 'What your company does, for whom, and where it is headed.',
    description: 'Placeholder in the empty brief field.',
  },
  briefHint: {
    id: 'onboarding.briefHint',
    defaultMessage: 'You can edit this later in your company profile.',
    description: 'Hint under the brief field.',
  },
  briefRequired: {
    id: 'onboarding.briefRequired',
    defaultMessage: 'Describe your company in a few sentences',
    description: 'Error under the brief field when it was left empty.',
  },
  submit: {
    id: 'onboarding.submit',
    defaultMessage: 'Create company',
    description: 'Button that creates the new user\'s company and opens the app.',
  },
  createError: {
    id: 'onboarding.createError',
    defaultMessage: 'The company could not be created. Try again.',
    description: 'Error shown above the button when creating the company failed.',
  },
  created: {
    id: 'onboarding.created',
    defaultMessage: '{organizationName} created',
    description: 'Short confirmation once the company is created, such as "Acme created".',
  },
})

export default onboardingMessages
