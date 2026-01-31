/**
 * Strategy Commands
 * List, enable, disable strategies
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { isAuthenticated } from '../config.js';
import { getStrategies, updateStrategy, executeCommand } from '../api.js';

interface StrategiesOptions {
  json?: boolean;
}

export async function strategiesCommand(options: StrategiesOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Fetching strategies...').start();

  try {
    const strategies = await getStrategies();
    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(strategies, null, 2));
      return;
    }

    console.log(chalk.bold.cyan('\n Strategies\n'));

    if (strategies.length === 0) {
      console.log(chalk.gray('  No strategies configured\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Name'),
        chalk.cyan('Type'),
        chalk.cyan('Status'),
      ],
      colWidths: [20, 30, 20, 12],
    });

    for (const strategy of strategies) {
      const statusColor = {
        enabled: chalk.green,
        disabled: chalk.gray,
        error: chalk.red,
      }[strategy.status as string] || chalk.white;

      table.push([
        strategy.id,
        strategy.name,
        strategy.strategyType,
        statusColor(strategy.status.toUpperCase()),
      ]);
    }

    console.log(table.toString());
    console.log(chalk.gray('\n  Use `clawfi enable <strategy>` or `clawfi disable <strategy>` to toggle\n'));

  } catch (err) {
    spinner.fail('Failed to fetch strategies');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}

export async function enableStrategyCommand(strategy: string): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora(`Enabling strategy: ${strategy}`).start();

  try {
    const result = await executeCommand(`enable strategy ${strategy}`);
    
    if (result.success) {
      spinner.succeed(chalk.green(result.message));
    } else {
      spinner.fail(chalk.red(result.message));
    }
    console.log();

  } catch (err) {
    spinner.fail('Failed to enable strategy');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}

export async function disableStrategyCommand(strategy: string): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora(`Disabling strategy: ${strategy}`).start();

  try {
    const result = await executeCommand(`disable strategy ${strategy}`);
    
    if (result.success) {
      spinner.succeed(chalk.green(result.message));
    } else {
      spinner.fail(chalk.red(result.message));
    }
    console.log();

  } catch (err) {
    spinner.fail('Failed to disable strategy');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}
