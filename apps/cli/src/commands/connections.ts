/**
 * Connections Commands
 * List all connectors and their status
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { isAuthenticated } from '../config.js';
import { getConnections } from '../api.js';

interface ConnectionsOptions {
  json?: boolean;
}

export async function connectionsCommand(options: ConnectionsOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Fetching connections...').start();

  try {
    const connections = await getConnections();
    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(connections, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n Connections\n'));

    if (connections.length === 0) {
      console.log(chalk.gray('  No connections configured\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Type'),
        chalk.cyan('Chain'),
        chalk.cyan('Status'),
        chalk.cyan('Enabled'),
      ],
      colWidths: [25, 15, 12, 12, 10],
    });

    for (const conn of connections) {
      const statusColor = {
        connected: chalk.green,
        degraded: chalk.yellow,
        offline: chalk.gray,
        error: chalk.red,
      }[conn.status as string] || chalk.white;

      const enabledIcon = conn.enabled 
        ? chalk.green('') 
        : chalk.gray('');

      table.push([
        conn.name || conn.id,
        conn.type,
        conn.chain || '-',
        statusColor(conn.status),
        enabledIcon,
      ]);
    }

    console.log(table.toString());
    
    // Summary
    const online = connections.filter(c => c.status === 'connected').length;
    const total = connections.length;
    console.log(chalk.gray(`\n  ${online}/${total} connections online\n`));

  } catch (err) {
    spinner.fail('Failed to fetch connections');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}
