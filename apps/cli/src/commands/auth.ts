/**
 * Auth Commands
 * Login, logout, whoami
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { config, saveAuth, clearAuth, getHost, DEFAULT_HOST, isAuthenticated } from '../config.js';
import { login, request } from '../api.js';

interface LoginOptions {
  email?: string;
  password?: string;
  host?: string;
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  console.log(chalk.bold('\nClawFi Login\n'));

  // Get host
  let host = options.host || config.get('host') || DEFAULT_HOST;
  
  // Interactive prompts if not provided
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'API Host:',
      default: host,
      when: !options.host && !config.get('host'),
    },
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      default: config.get('user') || undefined,
      when: !options.email,
      validate: (input: string) => input.includes('@') || 'Please enter a valid email',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*',
      when: !options.password,
    },
  ]);

  host = options.host || answers.host || host;
  const email = options.email || answers.email;
  const password = options.password || answers.password;

  const spinner = ora('Logging in...').start();

  try {
    const result = await login(email, password, host);
    
    // Save credentials
    saveAuth(host, result.token, result.user.email);
    
    spinner.succeed(chalk.green('Logged in successfully'));
    console.log(chalk.gray(`  User: ${result.user.email}`));
    console.log(chalk.gray(`  Host: ${host}\n`));
  } catch (err) {
    spinner.fail(chalk.red('Login failed'));
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}

export async function logoutCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in\n'));
    return;
  }

  clearAuth();
  console.log(chalk.green('\nLogged out successfully\n'));
}

export async function whoamiCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Fetching user info...').start();

  try {
    const response = await request<{ email: string; name?: string }>('GET', '/me');
    spinner.stop();
    
    console.log(chalk.bold('\nCurrent User\n'));
    console.log(chalk.gray('  Email:'), response.data?.email);
    if (response.data?.name) {
      console.log(chalk.gray('  Name:'), response.data.name);
    }
    console.log(chalk.gray('  Host:'), getHost());
    console.log();
  } catch (err) {
    spinner.fail('Failed to fetch user info');
    if (err instanceof Error) {
      console.error(chalk.red(`  ${err.message}\n`));
    }
    process.exit(1);
  }
}
