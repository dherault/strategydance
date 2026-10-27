/*
  The companies the bill's dialog suggests for what its field holds: those whose name holds it,
  case aside, but one it already names exactly, which there is nothing left to pick. Every company
  when the field is empty
*/
function suggestBillCompanies(companies: readonly string[], text: string) {
  const query = text.trim().toLowerCase()

  return companies.filter(company => {
    const name = company.toLowerCase()

    return name.includes(query) && name !== query
  })
}

export default suggestBillCompanies
