# Supported Sites

ClawFi integrates with popular DEX aggregators, token launchers, and trading platforms.

## Full Support

These sites have full ClawFi integration with automatic token detection:

### DEX Aggregators

| Site | URL | Chains |
|------|-----|--------|
| Dexscreener | dexscreener.com | All chains |
| DexTools | dextools.io | EVM chains |
| GeckoTerminal | geckoterminal.com | All chains |
| DEX Guru | dex.guru | EVM chains |

### Token Launchers

| Site | URL | Chains |
|------|-----|--------|
| Clanker | clanker.world | Base |
| Pump.fun | pump.fun | Solana |
| Four.meme | four.meme | BSC |
| SunPump | sunpump.meme | Tron |

### DEXs

| Site | URL | Chains |
|------|-----|--------|
| Uniswap | app.uniswap.org | Ethereum, Arbitrum, etc. |
| PancakeSwap | pancakeswap.finance | BSC, Ethereum |
| Raydium | raydium.io | Solana |
| Jupiter | jup.ag | Solana |
| BaseSwap | baseswap.fi | Base |

## URL Patterns

ClawFi detects tokens using these URL patterns:

### Dexscreener
```
https://dexscreener.com/{chain}/{pairAddress}
https://dexscreener.com/{chain}/{tokenAddress}
```

### Clanker
```
https://clanker.world/clanker/{tokenAddress}
https://www.clanker.world/clanker/{tokenAddress}
```

### Four.meme
```
https://four.meme/token/{tokenAddress}
```

### Pump.fun
```
https://pump.fun/{tokenAddress}
https://pump.fun/coin/{tokenAddress}
```

## Chain Detection

ClawFi automatically detects the blockchain from:
- URL path (e.g., `/ethereum/`, `/solana/`)
- Site context (e.g., Pump.fun = Solana)
- Token address format (0x = EVM, base58 = Solana)

## Adding Custom Sites

Currently, custom site support is not available in the extension. If you'd like to see a specific site supported, please:

1. Open an issue on GitHub
2. Include the site URL and example token pages
3. Describe the URL pattern for token pages

## Site-Specific Features

### Dexscreener
- Full pair analysis
- Historical data
- All supported chains

### Clanker
- Base chain tokens
- Launch detection
- Creator analysis

### Four.meme
- BSC chain tokens
- Meme token focus
- Early detection

### Pump.fun
- Solana tokens
- Bonding curve analysis
- Migration tracking

## Troubleshooting

### Site Not Detected

If ClawFi doesn't appear on a supported site:

1. Ensure you're on a token page (not the homepage)
2. Check that the extension is enabled
3. Refresh the page
4. Clear browser cache

### Wrong Token Detected

If ClawFi shows wrong token data:

1. Check the URL contains a valid token address
2. Ensure you're on a single token page (not a list)
3. Report the issue with the URL

## Coming Soon

Sites in development:
- Birdeye (Solana)
- DEXScreener Pro
- TradingView integration
- More Solana DEXs

## Request a Site

Want ClawFi on your favorite platform? Let us know:
- GitHub Issues
- Discord community
- Twitter @ClawFiAI
