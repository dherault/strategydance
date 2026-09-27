import { defineMessages } from 'react-intl'

/*
  Ids are explicit and dotted, `<messageType>.<path>`, and must be unique across every message file:
  the translation lock is indexed by id alone, so a message that moves between files keeps its
  translations. `collectSourceMessages` throws on a duplicate

  Never write an em dash in a defaultMessage or a description. It reads as machine-written, and
  every translated locale inherits whatever the English carries
*/
const landingMessages = defineMessages({
  logIn: {
    id: 'landing.logIn',
    defaultMessage: 'Log in',
    description: 'Button in the header of the public home page that leads to the sign-in page, for somebody who already has an account.',
  },
  signUp: {
    id: 'landing.signUp',
    defaultMessage: 'Sign up',
    description: 'Button in the header of the public home page that leads to the sign-up page, for somebody new.',
  },
  beta: {
    id: 'landing.beta',
    defaultMessage: 'Now in beta',
    description: 'Small label above the main heading of the public home page, saying the product is in beta.',
  },
  title: {
    id: 'landing.title',
    defaultMessage: 'Startup chaos, in harmony',
    description: 'Main heading of the public home page, a short slogan. Strategy Dance helps founders bring order to the mess of running a startup.',
  },
  subtitle: {
    id: 'landing.subtitle',
    defaultMessage: 'Strategy Dance helps entrepreneurs act on their projects with AI guidance and human wisdom. The MVP is open to everyone while we build toward AI execution.',
    description: 'Paragraph under the main heading of the public home page. Strategy Dance is the product name and stays untranslated. MVP means minimum viable product.',
  },
  start: {
    id: 'landing.start',
    defaultMessage: 'Start your journey',
    description: 'Main button of the public home page, under the heading, that leads to the sign-up page.',
  },
  copyright: {
    id: 'landing.copyright',
    defaultMessage: '© {year} Strategy Dance',
    description: 'Copyright notice in the footer of the public pages. {year} is the current year, such as 2026. Strategy Dance is the product name and stays untranslated.',
  },
  github: {
    id: 'landing.github',
    defaultMessage: 'GitHub',
    description: 'Link in the footer of the public pages to the project\'s source code on GitHub. A brand name, so it stays untranslated.',
  },
})

export default landingMessages
