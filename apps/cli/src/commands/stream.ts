/**
 * Stream Command
 * Real-time signal streaming via WebSocket
 */

import chalk from 'chalk';
import WebSocket from 'ws';
import { isAuthenticated, getHost, getToken } from '../config.js';

interface StreamOptions {
  notify?: boolean;
}

interface Signal {
  id: string;
  ts: number;
  severity: string;
  signalType: string;
  title: string;
  summary: string;
  token?: string;
  tokenSymbol?: string;
  chain?: string;
}

export async function streamCommand(options: StreamOptions): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow('\nNot logged in. Run `clawfi login` first.\n'));
    process.exit(1);
  }

  const host = getHost();
  const token = getToken();
  
  // Convert HTTP to WS
  const wsUrl = host.replace(/^http/, 'ws');
  const url = `${wsUrl}/ws?token=${token}`;

  console.log(chalk.bold.cyan('\n ClawFi Signal Stream\n'));
  console.log(chalk.gray(`  Connecting to ${host}...`));

  const ws = new WebSocket(url);
  let reconnectAttempts = 0;
  const maxReconnects = 10;

  function connect(): WebSocket {
    const socket = new WebSocket(url);

    socket.on('open', () => {
      reconnectAttempts = 0;
      console.log(chalk.green('  Connected! Streaming signals...\n'));
      console.log(chalk.gray('  Press Ctrl+C to stop\n'));
      console.log(chalk.gray('─'.repeat(60)));
    });

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as { type: string; data: Signal };
        
        if (message.type === 'signal') {
          displaySignal(message.data);
        } else if (message.type === 'system_status') {
          // Optionally show system status updates
        }
      } catch {
        // Ignore parse errors
      }
    });

    socket.on('close', () => {
      console.log(chalk.yellow('\n  Connection closed.'));
      
      if (reconnectAttempts < maxReconnects) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(chalk.gray(`  Reconnecting in ${delay / 1000}s... (attempt ${reconnectAttempts}/${maxReconnects})`));
        setTimeout(() => connect(), delay);
      } else {
        console.log(chalk.red('  Max reconnection attempts reached. Exiting.\n'));
        process.exit(1);
      }
    });

    socket.on('error', (err) => {
      console.error(chalk.red(`  WebSocket error: ${err.message}`));
    });

    return socket;
  }

  function displaySignal(signal: Signal): void {
    const time = new Date(signal.ts).toLocaleTimeString();
    
    const severityBadge = {
      low: chalk.bgGray.white(' LOW '),
      medium: chalk.bgYellow.black(' MED '),
      high: chalk.bgRed.white(' HIGH '),
      critical: chalk.bgRed.white.bold(' CRIT '),
    }[signal.severity] || chalk.bgGray(' ??? ');

    console.log(`\n${chalk.gray(time)} ${severityBadge} ${chalk.white(signal.title)}`);
    
    if (signal.tokenSymbol) {
      console.log(chalk.gray(`  Token: ${chalk.cyan(signal.tokenSymbol)} on ${signal.chain || 'unknown'}`));
    }
    
    if (signal.summary && signal.summary !== signal.title) {
      console.log(chalk.gray(`  ${signal.summary.slice(0, 80)}${signal.summary.length > 80 ? '...' : ''}`));
    }
    
    console.log(chalk.gray('─'.repeat(60)));
  }

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n  Stopping stream...\n'));
    ws.close();
    process.exit(0);
  });

  connect();
}
