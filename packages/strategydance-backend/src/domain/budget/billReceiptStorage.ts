import createBucketStorage from '~utils/createBucketStorage'

/*
  Where bills' receipts are kept, each organization's `receipts/` folder, and the one module that
  touches them, so the tests stand a fake in for it. A receipt is written create-only, where it
  stays: nothing moves it, and only the sweep deletes it, once no bill holds it
*/
const billReceiptStorage = createBucketStorage()

export default billReceiptStorage
