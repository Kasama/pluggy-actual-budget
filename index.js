import actualApi from '@actual-app/api';
import pluggy from 'pluggy-sdk';
import dotenvy from 'dotenvy';

// Create this that exports acctounMapping, an object that has the pluggy account as they keys and actual account as the value.
// export const accountMapping = {
//   "pluggy account id": "actual account id",
// };
import { accountMapping } from './accountMapping.js';
import { cliMain } from './cli.js';

/**
 * @typedef {object} Transaction
 * @property {string} [id]
 * @property {string} account - The account ID
 * @property {date} date - The transaction date
 * @property {integer} [amount] - The transaction amount
 * @property {string} [payee] - In a create request, this overrides the payee_name
 * @property {string} [payee_name] - If given, a payee might be created with this name. Only available in a create request
 * @property {string} [imported_payee] - This can be anything. Meant to represent the raw description when importing
 * @property {string} [category]
 * @property {string} [notes] - The transaction notes
 * @property {string} [imported_id] - A unique id used outside Actual. This is used to avoid duplicate transactions
 * @property {string} [transfer_id] - If a transfer, the id of the transaction in the other account for the transfer
 * @property {boolean} [cleared] - A flag indicating if the transaction is cleared
 * @property {Transaction} [subtransactions] - Array of subtransactions for a split transaction
 */

/**
 * @typedef {object} AppConfig
 * @property {string} actualLocalPath
 * @property {string} actualServerURL
 * @property {string} actualMainPassword
 * @property {string} actualSyncId
 * @property {string} actualSyncPassword
 * @property {string} pluggyClientId
 * @property {string} pluggyClientSecret
 * @property {string[]} pluggyClientItemIds
 */


(async () => {
  dotenvy()

  /** @type {AppConfig} */
  const config = {
    actualLocalPath: process.cwd() + (process.env.ACTUAL_LOCAL_PATH || '/actual-local'),
    actualServerURL: (process.env.ACTUAL_SERVER || 'http://localhost:5006'),
    actualMainPassword: process.env.ACTUAL_MAIN_PASSWORD,
    actualSyncId: process.env.ACTUAL_SYNC_ID,
    actualSyncPassword: process.env.ACTUAL_SYNC_PASSWORD,
    pluggyClientId: process.env.PLUGGY_CLIENT_ID,
    pluggyClientSecret: process.env.PLUGGY_CLIENT_SECRET,
    // Item is the account connection in Pluggy, it contains multiple accounts
    pluggyClientItemIds: (process.env.PLUGGY_ITEM_IDS || '').split(","),
  }

  const ignoredTransactions = []

  // Setup Actual budget
  await actualApi.init({
    // Budget data will be cached locally here, in subdirectories for each file.
    dataDir: config.actualLocalPath,
    // This is the URL of your running server
    serverURL: config.actualServerURL,
    // This is the password you use to log into the server
    password: config.actualMainPassword,
  });

  await actualApi.downloadBudget(config.actualSyncId, {
    password: config.actualSyncPassword,
  });

  // Setup Pluggy
  let pluggyClient = new pluggy.PluggyClient({
    clientId: config.pluggyClientId,
    clientSecret: config.pluggyClientSecret,
  })


  // check if cli handling is needed
  if (process.argv.length > 2) {
    const returnValue = await cliMain({
      actualClient: actualApi,
      pluggyClient: pluggyClient,
      config: config,
    })

    actualApi.shutdown()

    return returnValue
  }

  for (const pluggyAccountID in accountMapping) {
    const actualAccountID = accountMapping[pluggyAccountID]

    let account = await pluggyClient.fetchAccount(pluggyAccountID)

    let transactions = await pluggyClient.fetchTransactions(account.id, {
      from: '2024-07-10'
    })

    const creditMultiplier = account.type === 'CREDIT' ? -1 : 1;
    console.log("account type:", account.type, "multiplier", creditMultiplier)

    const actualTransactions = transactions.results
      .filter((pluggyTransaction) => ignoredTransactions.reduce((acc, r) => acc && !r.test(pluggyTransaction.description), true))
      .map((pluggyTransaction) => {
        console.log("pluggy trans: '", pluggyTransaction)
        /** @type {Transaction} actualTransaction */
        const actualTransaction = {
          account: actualAccountID,
          date: pluggyTransaction.date,
          amount: Math.round(pluggyTransaction.amount * 100) * creditMultiplier,
          imported_payee: pluggyTransaction.description,
          imported_id: pluggyTransaction.id,
          notes: pluggyTransaction.description,
          cleared: true,
        }
        return actualTransaction
      })
    const importResults = await actualApi.importTransactions(actualAccountID, actualTransactions)
    console.log("import results: ", importResults)
  }

  // let actualAccounts = await actualApi.getAccounts()
  // console.log(actualAccounts)


  // console.log("Transactions: ", transactions)

  await actualApi.shutdown();
})();

