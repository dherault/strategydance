import { defineMessages } from 'react-intl'

const authenticationMessages = defineMessages({
  layoutPasswordResetSuccess: {
    id: 'authentication.layout.passwordResetSuccess',
    defaultMessage: 'Check your emails for a password reset link.',
    description: 'Confirmation shown on the sign-in page after a password reset email has been requested.',
  },
  googleButtonContinue: {
    id: 'authentication.googleButton.continue',
    defaultMessage: 'Continue with Google',
    description: 'Button label for signing in with a Google account.',
  },
  modeStartOr: {
    id: 'authentication.mode.start.or',
    defaultMessage: 'or',
    description: 'Separator between the Google button and the email field.',
  },
  modeLoginGreeting: {
    id: 'authentication.mode.login.greeting',
    defaultMessage: 'Hi {email}',
    description: 'Greeting shown once the typed email has been recognized as an existing account.',
  },
  modeLoginTitle: {
    id: 'authentication.mode.login.title',
    defaultMessage: 'Welcome back',
    description: 'Heading shown above the password field for an existing account.',
  },
  modeLoginGooglePrompt: {
    id: 'authentication.mode.login.googlePrompt',
    defaultMessage: 'Use your Google account to continue',
    description: 'Instruction shown when the recognized account can only sign in with Google.',
  },
  modeLoginBothPrompt: {
    id: 'authentication.mode.login.bothPrompt',
    defaultMessage: 'You can use either Google or your password to continue',
    description: 'Instruction shown when the recognized account has both Google and password sign-in.',
  },
  modeSignupTitle: {
    id: 'authentication.mode.signup.title',
    defaultMessage: 'Create your account',
    description: 'Heading shown above the password fields when the typed email has no account yet.',
  },
  fieldEmail: {
    id: 'authentication.field.email',
    defaultMessage: 'Email',
    description: 'Label of the email field.',
  },
  fieldPassword: {
    id: 'authentication.field.password',
    defaultMessage: 'Password',
    description: 'Label of the password field.',
  },
  fieldPasswordConfirmation: {
    id: 'authentication.field.passwordConfirmation',
    defaultMessage: 'Confirm password',
    description: 'Label of the field that repeats the password when creating an account.',
  },
  placeholderEmail: {
    id: 'authentication.placeholder.email',
    defaultMessage: 'you@example.com',
    description: 'Placeholder text inside the email field.',
  },
  actionContinue: {
    id: 'authentication.action.continue',
    defaultMessage: 'Continue',
    description: 'Submit button label on the email step, before the account is known.',
  },
  actionLogIn: {
    id: 'authentication.action.logIn',
    defaultMessage: 'Log in',
    description: 'Submit button label on the password step for an existing account.',
  },
  actionSignUp: {
    id: 'authentication.action.signUp',
    defaultMessage: 'Sign up',
    description: 'Submit button label on the account creation step.',
  },
  actionBack: {
    id: 'authentication.action.back',
    defaultMessage: 'Back',
    description: 'Link that returns to the email step, or to the sign-in page from password reset.',
  },
  actionShowPassword: {
    id: 'authentication.action.showPassword',
    defaultMessage: 'Show password',
    description: 'Accessible label of the control that reveals the password being typed.',
  },
  actionHidePassword: {
    id: 'authentication.action.hidePassword',
    defaultMessage: 'Hide password',
    description: 'Accessible label of the control that hides the password being typed.',
  },
  passwordForgotQuestion: {
    id: 'authentication.password.forgotQuestion',
    defaultMessage: 'Forgot your password?',
    description: 'Link to the password reset page, shown under the password field.',
  },
  passwordResetTitle: {
    id: 'authentication.passwordReset.title',
    defaultMessage: 'Reset your password',
    description: 'Heading on the password reset page.',
  },
  passwordResetDescription: {
    id: 'authentication.passwordReset.description',
    defaultMessage: 'Enter your email and we will send you a link to choose a new password.',
    description: 'Explanation under the heading on the password reset page.',
  },
  passwordResetAction: {
    id: 'authentication.passwordReset.action',
    defaultMessage: 'Send the link',
    description: 'Submit button label on the password reset page.',
  },
  validationEmailInvalid: {
    id: 'authentication.validation.emailInvalid',
    defaultMessage: 'Enter a valid email address.',
    description: 'Validation error shown under the email field.',
  },
  validationPasswordMin: {
    id: 'authentication.validation.passwordMin',
    defaultMessage: 'Your password needs at least {minPasswordLength} characters.',
    description: 'Validation error shown when the password is too short.',
  },
  validationPasswordMax: {
    id: 'authentication.validation.passwordMax',
    defaultMessage: 'Your password can be at most {maxPasswordLength} characters.',
    description: 'Validation error shown when the password is too long.',
  },
  validationPasswordConfirmationMismatch: {
    id: 'authentication.validation.passwordConfirmationMismatch',
    defaultMessage: 'The two passwords do not match.',
    description: 'Validation error shown when the password confirmation differs from the password.',
  },
  errorDefault: {
    id: 'authentication.error.default',
    defaultMessage: 'Something went wrong. Please try again.',
    description: 'Fallback error shown when the authentication service reports a code we do not recognize.',
  },
  errorEmailAlreadyInUse: {
    id: 'authentication.error.emailAlreadyInUse',
    defaultMessage: 'An account already uses this email address.',
    description: 'Error shown when creating an account with an email that is already registered.',
  },
  errorInvalidEmail: {
    id: 'authentication.error.invalidEmail',
    defaultMessage: 'This email address is not valid.',
    description: 'Error shown when the authentication service rejects the email address.',
  },
  errorWeakPassword: {
    id: 'authentication.error.weakPassword',
    defaultMessage: 'This password is too weak. Please choose a longer one.',
    description: 'Error shown when the authentication service rejects the password as too weak.',
  },
  errorUserDisabled: {
    id: 'authentication.error.userDisabled',
    defaultMessage: 'This account has been disabled.',
    description: 'Error shown when signing in to an account an administrator has disabled.',
  },
  errorInvalidCredential: {
    id: 'authentication.error.invalidCredential',
    defaultMessage: 'That password does not match this account.',
    description: 'Error shown when the password is wrong.',
  },
  errorPopupClosedByUser: {
    id: 'authentication.error.popupClosedByUser',
    defaultMessage: 'The Google sign-in window was closed before it finished.',
    description: 'Error shown when the Google sign-in popup is dismissed.',
  },
  errorCredentialAlreadyInUse: {
    id: 'authentication.error.credentialAlreadyInUse',
    defaultMessage: 'Another account already uses these credentials.',
    description: 'Error shown when linking credentials that belong to a different account.',
  },
  errorTooManyRequests: {
    id: 'authentication.error.tooManyRequests',
    defaultMessage: 'Too many attempts. Please wait a moment and try again.',
    description: 'Error shown when the authentication service is rate limiting this device.',
  },
  errorNetworkRequestFailed: {
    id: 'authentication.error.networkRequestFailed',
    defaultMessage: 'We could not reach the server. Check your connection and try again.',
    description: 'Error shown when the authentication request could not reach the network.',
  },
})

export default authenticationMessages
