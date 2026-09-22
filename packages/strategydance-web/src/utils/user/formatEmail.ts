// Trimmed and lowercased, which is what makes the address the reader typed match the one
// stored: Postgres compares the column exactly, and a trailing space off a password manager
// would otherwise look like a different person
function formatEmail(email: string) {
  return email.trim().toLowerCase()
}

export default formatEmail
