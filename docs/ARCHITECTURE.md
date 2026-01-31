# ClawFi Architecture

## Overview

ClawFi is a crypto intelligence agent designed to run 24/7 on local hardware (Raspberry Pi, Mac mini, VPS) or containerized environments. It provides:

- **Real-time monitoring** of CEX and DEX activity
- **Strategy-based signal generation** for detecting notable events (e.g., wallet rotations)
- **Risk-controlled execution** with comprehensive guardrails
- **Web dashboard** for monitoring and control
- **Chrome extension** for contextual token information

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         ClawFi System                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Dashboard  │    │   Extension  │    │  External    │       │
│  │   (Next.js)  │    │   (Chrome)   │    │  Webhooks    │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                    │               │
│         └───────────────────┼────────────────────┘               │
│                             │                                    │
│                     ┌───────▼───────┐                           │
│                     │   ClawFi SDK  │                           │
│                     │  (REST + WS)  │                           │
│                     └───────┬───────┘                           │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │                    ClawFi Node                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │                 Fastify Server                   │    │    │
│  │  │  • REST API     • WebSocket     • Rate Limiting │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                          │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │    │
│  │  │   Risk     │  │  Strategy  │  │    Signal      │    │    │
│  │  │   Engine   │  │  Scheduler │  │    Service     │    │    │
│  │  └────────────┘  └────────────┘  └────────────────┘    │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │               Connectors                          │   │    │
│  │  │  • Binance CEX    • EVM DEX    • (Launchpads)   │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│    ┌────▼────┐        ┌─────▼─────┐       ┌────▼────┐          │
│    │ Postgres │        │   Redis   │       │  Vault  │          │
│    │   (DB)   │        │  (Queue)  │       │(Secrets)│          │
│    └──────────┘        └───────────┘       └─────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

```
/clawfi
├── /apps
│   ├── /dashboard     # Next.js web UI
│   ├── /extension     # Chrome MV3 extension
│   └── /node          # Fastify API + scheduler
│
├── /packages
│   ├── /core          # Domain models, schemas, types
│   ├── /connectors    # Exchange/DEX integrations
│   ├── /vault         # Secret encryption
│   ├── /sdk           # Client SDK for UI/extension
│   └── /config        # Shared configs
│
└── /infra
    ├── /docker        # Container configs
    └── /systemd       # Service templates
```

## Data Flow

### Signal Generation

1. **Event Collection**: Connectors poll or subscribe to exchange/chain events
2. **Normalization**: Raw events are converted to unified `Event` schema
3. **Strategy Processing**: Enabled strategies process events
4. **Signal Emission**: Strategies emit `Signal` objects when conditions are met
5. **Distribution**: Signals are stored in DB and broadcast via WebSocket

### Action Execution

1. **Request**: User or strategy requests an action (e.g., place order)
2. **Risk Check**: Risk Engine validates against policy constraints
3. **Audit**: Request and decision are logged
4. **Execution**: If approved, connector executes the action
5. **Confirmation**: Result is audited and user notified

## Key Design Decisions

### Local-First

- All data stored locally (Postgres + Redis)
- No cloud dependencies required
- Can run on Raspberry Pi or VPS
- Optional cloud deployment via Docker

### Security-First

- API keys encrypted at rest (AES-256-GCM)
- No private key custody by default
- Withdrawal APIs intentionally disabled
- Full audit trail of all actions
- Kill switch for emergency stop

### Modularity

- Connectors are pluggable interfaces
- Strategies implement standard interface
- New exchanges/protocols can be added independently
- Core domain models are shared across all components

### Alerts-Only Default

- Default mode is monitoring and alerting
- Auto-trading requires explicit enablement
- Dry-run mode for testing without execution
- Multiple safety layers before any trade

## Technologies

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict mode) |
| API | Fastify + WebSocket |
| Database | PostgreSQL + Prisma |
| Queue | Redis + BullMQ |
| EVM | viem |
| Frontend | Next.js 14 + Tailwind |
| Extension | Chrome MV3 + Vite |
| Auth | JWT + Argon2 |
| Encryption | AES-256-GCM + HKDF |


