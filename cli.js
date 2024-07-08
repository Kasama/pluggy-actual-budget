import actualApi from '@actual-app/api';
import pluggy from 'pluggy-sdk';

import { program } from "commander"
// import packageInfo from "./package.json"

// program.version(packageInfo.version)

/**
 * @typedef {object} CliMainParams
 * @property {actualApi} actualClient
 * @property {pluggy.PluggyClient} pluggyClient
 * @property {AppConfig} config
 */

/** @param {CliMainParams} params */
export const cliMain = async ({ actualClient, pluggyClient, config }) => {

  program.command('actual list accounts')
    .description('lists the accounts in ActualBudget')
    .action(async () => {
      const accounts = await actualClient.getAccounts()
      accounts.forEach(account => {
        console.log(account.id, ": ", account.name)
      })
    })

  program.command('pluggy list accounts')
    .description('lists the accounts in Pluggy')
    .action(async () => {
      config.pluggyClientItemIds.forEach(async (itemId) => {
        const accounts = await pluggyClient.fetchAccounts(itemId)
        accounts.results.forEach(account => {
          console.log(account.id, ": ", account.name, ": ", account.type)
        })
      })
    })

  program.parse(process.argv)

  return 0
}
