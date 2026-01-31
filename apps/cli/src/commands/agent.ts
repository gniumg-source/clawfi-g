/**
 * Agent Commands
 * Status, command execution, kill switch
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { isAuthenticated } from '../config.js';
import { getAgentStatus, executeCommand, setKillSwitch } from '../api.js';

export async function statusCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Fetching agent status...').start();

  try {
    const status = await getAgentStatus();
    spinner.stop();

    console.log(chalk.bold.cyan('\n ClawFi Agent Status\n'));

    // Version and uptime
    console.log(chalk.gray('  Version:'), chalk.white(`v${status.version}`));
    console.log(chalk.gray('  Uptime:'), chalk.white(status.uptimeFormatted));

    // Kill switch status
    const ksStatus = status.killSwitchActive
      ? chalk.bgRed.white(' ACTIVE ')
      : chalk.bgGreen.black(' OFF ');
    console.log(chalk.gray('  Kill Switch:'), ksStatus);

    // Dry run mode
    const dryRun = status.dryRunMode
      ? chalk.yellow('Yes (simulated)')
      : chalk.green('No (live trading)');
    console.log(chalk.gray('  Dry Run:'), dryRun);

    console.log();

    // Stats table
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [25, 15],
    });

    table.push(
      ['Connectors', `${status.connectors.connected}/${status.connectors.total} online`],
      ['Strategies', `${status.strategies.enabled}/${status.strategies.total} enabled`],
      ['Signals Today', String(status.signalsToday)],
      ['Watched Tokens', String(status.watchedTokens)],
      ['Watched Wallets', String(status.watchedWallets)],
    );

    console.log(table.toString());
    console.log();

  } catch (err) {
    spinner.fail('Failed to fetch status');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}

export async function commandCommand(args: string[]): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const command = args.join(' ');
  
  if (!command) {
    console.log(chalk.yellow('\nPlease provide a command. Examples:'));
    console.log(chalk.gray('  clawfi cmd watch token 0x1234... base'));
    console.log(chalk.gray('  clawfi cmd killswitch on'));
    console.log(chalk.gray('  clawfi cmd status'));
    console.log(chalk.gray('  clawfi cmd help\n'));
    return;
  }

  const spinner = ora(`Executing: ${command}`).start();

  try {
    const result = await executeCommand(command);
    
    if (result.success) {
      spinner.succeed(chalk.green(result.message));
      
      if (result.data && Object.keys(result.data).length > 0) {
        console.log(chalk.gray('\n  Details:'));
        for (const [key, value] of Object.entries(result.data)) {
          if (key === 'commands' && Array.isArray(value)) {
            console.log(chalk.gray(`    Available commands:`));
            for (const cmd of value) {
              console.log(chalk.white(`      - ${cmd}`));
            }
          } else {
            console.log(chalk.gray(`    ${key}:`), chalk.white(String(value)));
          }
        }
      }
    } else {
      spinner.fail(chalk.red(result.message));
    }
    console.log();

  } catch (err) {
    spinner.fail('Command failed');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}

export async function killswitchCommand(action: string): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const normalizedAction = action.toLowerCase();
  
  if (normalizedAction !== 'on' && normalizedAction !== 'off') {
    console.log(chalk.yellow('\nInvalid action. Use: clawfi killswitch on|off\n'));
    process.exit(1);
  }

  const active = normalizedAction === 'on';
  const spinner = ora(active ? 'Activating kill switch...' : 'Deactivating kill switch...').start();

  try {
    await setKillSwitch(active);
    
    if (active) {
      spinner.succeed(chalk.red.bold(' KILL SWITCH ACTIVATED - All trading blocked'));
    } else {
      spinner.succeed(chalk.green(' Kill switch deactivated - Normal operations resumed'));
    }
    console.log();

  } catch (err) {
    spinner.fail('Failed to update kill switch');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}
