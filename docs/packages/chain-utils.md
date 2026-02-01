# chain-utils

Multi-chain utility functions for address validation, formatting, and chain detection.

## Installation

```bash
npm install @clawfi/chain-utils
```

## Quick Start

```typescript
import { 
  isValidAddress,
  detectChainType,
  shortenAddress,
  getChainInfo,
  getExplorerUrl 
} from '@clawfi/chain-utils';

// Validate address
isValidAddress('0x...', 'evm');     // true
isValidAddress('So1...', 'solana'); // true

// Detect chain type
detectChainType('0x...');  // 'evm'
detectChainType('So1...'); // 'solana'

// Format address
shortenAddress('0x1234...5678'); // '0x1234...5678'

// Get chain info
getChainInfo('ethereum'); // { name, nativeCurrency, ... }

// Get explorer URL
getExplorerUrl('ethereum', '0x...', 'address');
```

## Address Utilities

### isValidAddress(address, type?)

Validate address format.

```typescript
// Auto-detect type
isValidAddress('0x1234567890abcdef1234567890abcdef12345678');

// Specific type
isValidAddress('0x...', 'evm');
isValidAddress('So1...', 'solana');
isValidAddress('0x...', 'move');
```

### detectChainType(address)

Detect blockchain type from address.

```typescript
detectChainType('0x1234...');  // 'evm'
detectChainType('So1111...');  // 'solana'
detectChainType('0x1::...');   // 'move'
```

### shortenAddress(address, chars?)

Shorten address for display.

```typescript
shortenAddress('0x1234567890abcdef1234567890abcdef12345678');
// '0x1234...5678'

shortenAddress('0x123...', 6);
// '0x123456...345678'
```

### checksumAddress(address)

Convert to checksum format (EVM).

```typescript
checksumAddress('0xabcdef...');
// '0xAbCdEf...'
```

## Chain Utilities

### getChainInfo(chainId)

Get chain information.

```typescript
const info = getChainInfo('ethereum');

console.log(info.name);           // 'Ethereum'
console.log(info.shortName);      // 'ETH'
console.log(info.nativeCurrency); // 'ETH'
console.log(info.chainId);        // 1
console.log(info.explorer);       // 'https://etherscan.io'
```

### getSupportedChains()

Get all supported chains.

```typescript
const chains = getSupportedChains();

for (const chain of chains) {
  console.log(`${chain.name} (${chain.id})`);
}
```

### getChainByChainId(chainId)

Get chain by numeric ID.

```typescript
const chain = getChainByChainId(1);     // ethereum
const chain = getChainByChainId(56);    // bsc
const chain = getChainByChainId(8453);  // base
```

## Explorer Utilities

### getExplorerUrl(chain, value, type)

Get block explorer URL.

```typescript
// Address URL
getExplorerUrl('ethereum', '0x...', 'address');
// 'https://etherscan.io/address/0x...'

// Transaction URL
getExplorerUrl('ethereum', '0x...', 'tx');
// 'https://etherscan.io/tx/0x...'

// Token URL
getExplorerUrl('ethereum', '0x...', 'token');
// 'https://etherscan.io/token/0x...'

// Block URL
getExplorerUrl('ethereum', '12345678', 'block');
// 'https://etherscan.io/block/12345678'
```

### getScanApiUrl(chain)

Get scan API URL.

```typescript
getScanApiUrl('ethereum'); // 'https://api.etherscan.io/api'
getScanApiUrl('bsc');      // 'https://api.bscscan.com/api'
```

## Supported Chains

```typescript
const CHAINS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    nativeCurrency: 'ETH',
    explorer: 'https://etherscan.io',
  },
  bsc: {
    id: 'bsc',
    name: 'BNB Smart Chain',
    chainId: 56,
    nativeCurrency: 'BNB',
    explorer: 'https://bscscan.com',
  },
  polygon: { ... },
  arbitrum: { ... },
  optimism: { ... },
  base: { ... },
  avalanche: { ... },
  fantom: { ... },
  solana: { ... },
  // ... more
};
```

## Type Definitions

```typescript
type ChainType = 'evm' | 'solana' | 'move' | 'unknown';

interface ChainInfo {
  id: string;
  name: string;
  shortName: string;
  chainId?: number;
  nativeCurrency: string;
  explorer: string;
  rpc?: string;
}

type ExplorerType = 'address' | 'tx' | 'token' | 'block';
```

## Links

- [GitHub](https://github.com/ClawFiAI/chain-utils)
- [npm](https://www.npmjs.com/package/@clawfi/chain-utils)
