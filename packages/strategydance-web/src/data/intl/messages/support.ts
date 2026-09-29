import { defineMessages } from 'react-intl'

/*
  Ids are explicit and dotted, `<messageType>.<path>`, and must be unique across every message file:
  the translation lock is indexed by id alone, so a message that moves between files keeps its
  translations. `collectSourceMessages` throws on a duplicate

  Never write an em dash in a defaultMessage or a description. It reads as machine-written, and
  every translated locale inherits whatever the English carries
*/
const supportMessages = defineMessages({
  backToApp: {
    id: 'support.backToApp',
    defaultMessage: 'Back to app',
    description: 'Button in the header of the support page that returns somebody signed in to the app.',
  },
  eyebrow: {
    id: 'support.eyebrow',
    defaultMessage: 'Support',
    description: "Small uppercase label above the founder's name on the support page, naming the page.",
  },
  role: {
    id: 'support.role',
    defaultMessage: 'Founder, Strategy Dance',
    description:
      "Job title under the founder's name on the support page. Strategy Dance is the product name and stays untranslated.",
  },
  lead: {
    id: 'support.lead',
    defaultMessage:
      'Stuck on something, found a bug, or want a second opinion on your plan? Reach out directly. I read and answer every message myself.',
    description:
      'Paragraph on the support page, written in the first person by the founder, inviting the reader to get in touch. Keep the personal, informal tone.',
  },
  bookMeeting: {
    id: 'support.bookMeeting',
    defaultMessage: 'Book a meeting',
    description: "Main button of the support page, which opens the founder's booking calendar in a new tab.",
  },
  messageOnX: {
    id: 'support.messageOnX',
    defaultMessage: 'Message on X',
    description:
      "Button on the support page that opens the founder's profile on X, the social network formerly called Twitter, in a new tab. X is a brand name and stays untranslated.",
  },
  whatsApp: {
    id: 'support.whatsApp',
    defaultMessage: 'WhatsApp',
    description:
      'Button on the support page that shows or hides a QR code opening a WhatsApp chat with the founder. A brand name, so it stays untranslated.',
  },
  whatsAppQrCodeAlt: {
    id: 'support.whatsAppQrCodeAlt',
    defaultMessage: 'QR code for a WhatsApp chat with {name}',
    description:
      "Alternative text of the QR code on the support page. {name} is the founder's name, such as David Hérault.",
  },
  whatsAppScan: {
    id: 'support.whatsAppScan',
    defaultMessage: "Scan with your phone's camera to open a WhatsApp chat with me.",
    description: 'Line under the WhatsApp QR code on the support page, written in the first person by the founder.',
  },
  showEmail: {
    id: 'support.showEmail',
    defaultMessage: 'Show email',
    description: "Button on the support page that reveals the founder's email address.",
  },
  hideEmail: {
    id: 'support.hideEmail',
    defaultMessage: 'Hide email',
    description: 'The same button on the support page once the email address shows, which hides it again.',
  },
  copy: {
    id: 'support.copy',
    defaultMessage: 'Copy',
    description: "Button beside the founder's email address on the support page that copies it to the clipboard.",
  },
  copied: {
    id: 'support.copied',
    defaultMessage: 'Copied',
    description:
      'What the copy button beside the email address on the support page says for a moment after copying it.',
  },
  emailCopied: {
    id: 'support.emailCopied',
    defaultMessage: 'Email copied',
    description: "Notification shown once the founder's email address is copied to the clipboard.",
  },
  copyError: {
    id: 'support.copyError',
    defaultMessage: 'Could not copy. Select the address instead.',
    description:
      'Error shown when the browser refuses to copy the email address to the clipboard, suggesting to select the address by hand.',
  },
  write: {
    id: 'support.write',
    defaultMessage: 'Write',
    description:
      "Button beside the founder's email address on the support page that opens a new email to it in the reader's mail app.",
  },
})

export default supportMessages
