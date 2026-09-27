import { useState } from 'react'
import { cn } from 'strategydance-design-system/lib/utils'

import LogOutButton from '~components/authentication/LogOutButton'
import OnboardingOrganizationForm from '~components/onboarding/OnboardingOrganizationForm'
import OnboardingPrologue from '~components/onboarding/OnboardingPrologue'
import OnboardingQuestion from '~components/onboarding/OnboardingQuestion'

import onboardingMessages from '~data/intl/messages/onboarding'

// The quiz, in the order it is asked. `correct` is the index of the answer that moves on
const QUESTIONS = [
  {
    question: onboardingMessages.workQuestion,
    answers: [onboardingMessages.workAnswerSome, onboardingMessages.workAnswerEnormous],
    correct: 1,
  },
  {
    question: onboardingMessages.timeQuestion,
    answers: [onboardingMessages.timeAnswerWeeks, onboardingMessages.timeAnswerYears],
    correct: 1,
  },
]

/*
  The whole screen somebody who belongs to no organization sees: the prologue, the quiz, one
  question at a time, then the form that creates their company. Step 0 is the prologue, then one
  step per question, then the form.

  It cannot be skipped, so there is no close button and no Escape. The one way out that is not
  forward is logging out, for somebody signed into the wrong account. The background crosses from
  the primary color to white as the prologue hands over
*/
function Onboarding() {
  const [step, setStep] = useState(0)

  const isPrologue = step === 0
  const questionIndex = step - 1
  const question = QUESTIONS[questionIndex]

  function goToNextStep() {
    setStep(currentStep => currentStep + 1)
  }

  return (
    <main className={cn('relative flex min-h-svh items-center justify-center transition-colors duration-900 ease-in-out', isPrologue ? 'bg-primary' : 'bg-white')}>
      <LogOutButton className={cn('absolute top-4 right-4', isPrologue && 'text-white not-disabled:hover:bg-primary-800 not-disabled:active:bg-primary-900')} />
      {isPrologue
        ? <OnboardingPrologue onDone={goToNextStep} />
        : question
          ? (
              <OnboardingQuestion
                key={questionIndex}
                index={step}
                count={QUESTIONS.length}
                question={question.question}
                answers={question.answers}
                correct={question.correct}
                onAnswered={goToNextStep}
              />
            )
          : <OnboardingOrganizationForm />}
    </main>
  )
}

export default Onboarding
