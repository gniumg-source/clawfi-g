/**
 * Signal Commands
 * List signals, watch tokens/wallets
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { isAuthenticated } from '../config.js';
import { getSignals, executeCommand } from '../api.js';

interface SignalsOptions {
  limit?: string;
  severity?: string;
  chain?: string;
  unacked?: boolean;
  json?: boolean;
}

export async function signalsCommand(options: SignalsOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Fetching signals...').start();

  try {
    const { signals, pagination } = await getSignals({
      limit: options.limit ? parseInt(options.limit, 10) : 10,
      severity: options.severity,
      chain: options.chain,
      acknowledged: options.unacked ? false : undefined,
    });

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(signals, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n Recent Signals\n'));

    if (signals.length === 0) {
      console.log(chalk.gray('  No signals found\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Time'),
        chalk.cyan('Severity'),
        chalk.cyan('Type'),
        chalk.cyan('Title'),
        chalk.cyan('Token'),
      ],
      colWidths: [18, 12, 18, 35, 12],
      wordWrap: true,
    });

    for (const signal of signals) {
      const time = new Date(signal.ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const severityColor = {
        low: chalk.gray,
        medium: chalk.yellow,
        high: chalk.red,
        critical: chalk.bgRed.white,
      }[signal.severity as string] || chalk.white;

      table.push([
        time,
        severityColor(signal.severity.toUpperCase()),
        signal.signalType,
        signal.title || signal.summary?.slice(0, 30) + '...',
        signal.tokenSymbol || signal.token?.slice(0, 10) || '-',
      ]);
    }

    console.log(table.toString());
    
    if (pagination) {
      console.log(chalk.gray(`\n  Showing ${signals.length} of ${pagination.total} signals`));
      console.log(chalk.gray(`  Use --limit <n> for more, --severity <level> to filter\n`));
    }

  } catch (err) {
    spinner.fail('Failed to fetch signals');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}

interface WatchOptions {
  chain?: string;
  label?: string;
}

export async function watchCommand(type: string, address: string, options: WatchOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  if (type !== 'token' && type !== 'wallet') {
    console.log(chalk.yellow('\nInvalid type. Use: clawfi watch token|wallet <address>\n'));
    process.exit(1);
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.log(chalk.yellow('\nInvalid address format. Expected 0x... (42 characters)\n'));
    process.exit(1);
  }

  const chain = options.chain || 'base';
  const command = `watch ${type} ${address} ${chain}`;
  
  const spinner = ora(`Watching ${type}...`).start();

  try {
    const result = await executeCommand(command);
    
    if (result.success) {
      spinner.succeed(chalk.green(result.message));
    } else {
      spinner.fail(chalk.red(result.message));
    }
    console.log();

  } catch (err) {
    spinner.fail('Failed to add watch');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}
