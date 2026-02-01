# wallet-tracker

Multi-chain wallet tracking library for monitoring wallet activity.

## Installation

```bash
npm install @clawfi/wallet-tracker
```

## Quick Start

```typescript
import { WalletTracker } from '@clawfi/wallet-tracker';

const tracker = new WalletTracker({
  apiKeys: {
    etherscan: 'YOUR_API_KEY',
    bscscan: 'YOUR_API_KEY',
  },
});

// Add wallet to track
tracker.addWallet({
  address: '0x...',
  chain: 'ethereum',
  label: 'Whale 1',
});

// Get transactions
const txs = await tracker.getTransactions('0x...');

// Get balance
const balance = await tracker.getBalance('0x...', 'ethereum');
```

## Features

- Multi-chain support (EVM + Solana)
- Real-time transaction tracking
- Balance monitoring
- Token transfer detection
- Rate-limited API calls
- Caching support

## Supported Chains

| Chain | Explorer API |
|-------|-------------|
| Ethereum | Etherscan |
| BSC | BscScan |
| Polygon | PolygonScan |
| Arbitrum | Arbiscan |
| Base | BaseScan |
| Solana | Solscan |

## Configuration

```typescript
const tracker = new WalletTracker({
  apiKeys: {
    etherscan: process.env.ETHERSCAN_API_KEY,
    bscscan: process.env.BSCSCAN_API_KEY,
    polygonscan: process.env.POLYGONSCAN_API_KEY,
    arbiscan: process.env.ARBISCAN_API_KEY,
    basescan: process.env.BASESCAN_API_KEY,
  },
  rateLimit: 5, // requests per second
  cache: true,
  cacheTtl: 60000,
});
```

## Methods

### addWallet(config)

Add wallet to track.

```typescript
tracker.addWallet({
  address: '0x...',
  chain: 'ethereum',
  label: 'Known Whale',
  tags: ['whale', 'dex'],
});
```

### removeWallet(address)

Remove wallet from tracking.

```typescript
tracker.removeWallet('0x...');
```

### getTransactions(address, options?)

Get transaction history.

```typescript
const txs = await tracker.getTransactions('0x...', {
  startBlock: 0,
  endBlock: 'latest',
  limit: 100,
});

for (const tx of txs) {
  console.log(`${tx.hash}: ${tx.from} -> ${tx.to}`);
  console.log(`Value: ${tx.value} ETH`);
}
```

### getTokenTransfers(address, options?)

Get token transfer history.

```typescript
const transfers = await tracker.getTokenTransfers('0x...', {
  tokenAddress: '0x...', // Optional: filter by token
});

for (const transfer of transfers) {
  console.log(`${transfer.tokenSymbol}: ${transfer.value}`);
}
```

### getBalance(address, chain)

Get native token balance.

```typescript
const balance = await tracker.getBalance('0x...', 'ethereum');
console.log(`Balance: ${balance} ETH`);
```

### getTokenBalances(address, chain)

Get all token balances.

```typescript
const balances = await tracker.getTokenBalances('0x...', 'ethereum');

for (const token of balances) {
  console.log(`${token.symbol}: ${token.balance}`);
}
```

## Monitoring

Set up continuous monitoring:

```typescript
tracker.on('transaction', (tx) => {
  console.log('New transaction:', tx.hash);
});

tracker.on('transfer', (transfer) => {
  console.log('Token transfer:', transfer);
});

// Start monitoring
await tracker.startMonitoring({
  interval: 30000, // Check every 30 seconds
  wallets: ['0x...', '0x...'],
});

// Stop monitoring
tracker.stopMonitoring();
```

## Data Types

```typescript
interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timestamp: number;
  blockNumber: number;
  status: 'success' | 'failed';
}

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  value: string;
  decimals: number;
  timestamp: number;
}
```

## Links

- [GitHub](https://github.com/ClawFiAI/wallet-tracker)
- [npm](https://www.npmjs.com/package/@clawfi/wallet-tracker)
