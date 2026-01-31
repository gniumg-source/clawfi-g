#!/usr/bin/env node
/**
 * ClawFi CLI
 * Command-line interface for ClawFi crypto intelligence agent
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { config } from './config.js';
import { loginCommand, logoutCommand, whoamiCommand } from './commands/auth.js';
import { statusCommand, commandCommand } from './commands/agent.js';
import { signalsCommand, watchCommand } from './commands/signals.js';
import { strategiesCommand } from './commands/strategies.js';
import { connectionsCommand } from './commands/connections.js';
import { streamCommand } from './commands/stream.js';

const VERSION = '0.1.0';

const program = new Command();

// ASCII Art Banner
const banner = `
${chalk.cyan('   _____ _                 ______ _ ')}
${chalk.cyan('  / ____| |               |  ____(_)')}
${chalk.cyan(' | |    | | __ ___      __| |__   _ ')}
${chalk.cyan(' | |    | |/ _\` \\ \\ /\\ / /|  __| | |')}
${chalk.cyan(' | |____| | (_| |\\ V  V / | |    | |')}
${chalk.cyan('  \\_____|_|\\__,_| \\_/\\_/  |_|    |_|')}
${chalk.gray('  Crypto Intelligence Agent CLI v' + VERSION)}
`;

program
  .name('clawfi')
  .description('ClawFi CLI - Your crypto intelligence command center')
  .version(VERSION)
  .hook('preAction', () => {
    // Show banner only on first command
    if (process.argv[2] !== '--version' && process.argv[2] !== '-V') {
      // console.log(banner);
    }
  });

// ==================================================
// Auth Commands
// ==================================================

program
  .command('login')
  .description('Login to ClawFi')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --password <password>', 'Password')
  .option('--host <url>', 'API host URL')
  .action(loginCommand);

program
  .command('logout')
  .description('Logout from ClawFi')
  .action(logoutCommand);

program
  .command('whoami')
  .description('Show current user info')
  .action(whoamiCommand);

// ==================================================
// Agent Commands
// ==================================================

program
  .command('status')
  .alias('s')
  .description('Show agent status overview')
  .action(statusCommand);

program
  .command('cmd <command...>')
  .alias('c')
  .description('Execute agent command (e.g., watch token, killswitch on)')
  .action(commandCommand);

// ==================================================
// Signal Commands
// ==================================================

program
  .command('signals')
  .alias('sig')
  .description('List recent signals')
  .option('-l, --limit <number>', 'Number of signals to show', '10')
  .option('-s, --severity <level>', 'Filter by severity (low, medium, high, critical)')
  .option('-c, --chain <chain>', 'Filter by chain')
  .option('--unacked', 'Show only unacknowledged signals')
  .option('-j, --json', 'Output as JSON')
  .action(signalsCommand);

program
  .command('watch <type> <address>')
  .description('Watch a token or wallet (type: token | wallet)')
  .option('-c, --chain <chain>', 'Chain name', 'base')
  .option('--label <label>', 'Optional label for wallet')
  .action(watchCommand);

// ==================================================
// Strategy Commands
// ==================================================

program
  .command('strategies')
  .alias('strat')
  .description('List and manage strategies')
  .option('-j, --json', 'Output as JSON')
  .action(strategiesCommand);

program
  .command('enable <strategy>')
  .description('Enable a strategy')
  .action(async (strategy: string) => {
    const { enableStrategyCommand } = await import('./commands/strategies.js');
    await enableStrategyCommand(strategy);
  });

program
  .command('disable <strategy>')
  .description('Disable a strategy')
  .action(async (strategy: string) => {
    const { disableStrategyCommand } = await import('./commands/strategies.js');
    await disableStrategyCommand(strategy);
  });

// ==================================================
// Connection Commands
// ==================================================

program
  .command('connections')
  .alias('conn')
  .description('List all connections')
  .option('-j, --json', 'Output as JSON')
  .action(connectionsCommand);

// ==================================================
// Stream Command (Real-time)
// ==================================================

program
  .command('stream')
  .description('Stream real-time signals')
  .option('--no-notify', 'Disable system notifications')
  .action(streamCommand);

// ==================================================
// Kill Switch Commands
// ==================================================

program
  .command('killswitch <action>')
  .alias('ks')
  .description('Control kill switch (on | off)')
  .action(async (action: string) => {
    const { killswitchCommand } = await import('./commands/agent.js');
    await killswitchCommand(action);
  });

// ==================================================
// Config Commands
// ==================================================

program
  .command('config')
  .description('Show current configuration')
  .option('--reset', 'Reset all configuration')
  .action(async (options: { reset?: boolean }) => {
    if (options.reset) {
      config.clear();
      console.log(chalk.green('Configuration reset'));
    } else {
      console.log(chalk.bold('\nCurrent Configuration:'));
      console.log(chalk.gray('Host:'), config.get('host') || chalk.yellow('(not set)'));
      console.log(chalk.gray('Logged in:'), config.get('token') ? chalk.green('Yes') : chalk.red('No'));
      if (config.get('user')) {
        console.log(chalk.gray('User:'), config.get('user'));
      }
    }
  });

// Help formatting
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: (cmd) => cmd.name(),
});

// Parse arguments
if (process.argv.length === 2) {
  console.log(banner);
  console.log(chalk.gray('Run `clawfi --help` for available commands\n'));
  program.help();
} else {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof Error) {
      console.error(chalk.red('Error:'), err.message);
    }
    process.exit(1);
  }
}
