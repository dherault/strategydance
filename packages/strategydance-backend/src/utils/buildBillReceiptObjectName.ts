import buildOrganizationStoragePrefix from '~utils/buildOrganizationStoragePrefix'
import toCanonicalUuid from '~utils/toCanonicalUuid'

type BillReceiptLocation = {
  organizationId: string
  receiptId: string
}

// Where a bill's receipt is kept in the bucket, its ids canonical: written once by its upload, and
// deleted only by the sweep or with its organization's folder
function buildBillReceiptObjectName({ organizationId, receiptId }: BillReceiptLocation) {
  return `${buildOrganizationStoragePrefix(organizationId, 'receipts')}${toCanonicalUuid(receiptId)}`
}

export default buildBillReceiptObjectName
