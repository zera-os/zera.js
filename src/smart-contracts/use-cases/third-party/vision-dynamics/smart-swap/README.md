# ZERA Smart Swap (Indexer-Powered)

SDK for executing token swaps on the ZERA DEX via the Vision Dynamics Indexer API's routing engine.

Unlike the [direct DEX SDK](../../dex/README.md) (which builds single-pool swaps locally), Smart Swap delegates route computation to the **Vision Dynamics Indexer API** — enabling multi-hop routing, split optimization, and real-time pool state awareness.

> **Requires access to a Vision Dynamics Indexer API instance** (default: `https://api.zerascan.io`). The indexer's `/v1/dex/swap` endpoint handles all route discovery, optimization, and transaction assembly. Your code only handles signing and submission.

## Why the Indexer?

The ZERA DEX is powered by an on-chain `smart_swap_proxy` contract with a multi-pool graph. Performing an optimized swap requires:

- **Route Discovery** — The indexer maintains an in-memory graph of all DEX liquidity pools and computes optimal multi-hop routes via BFS pathfinding
- **Split Optimization** — For larger trades, the indexer distributes volume across parallel paths to maximize output
- **Transaction Assembly** — The indexer serializes the correct `SmartContractExecuteTXN` protobuf with all hop parameters, fee structures, and slippage guards pre-filled
- **Pool State Sync** — The indexer uses atomic fingerprint polling to keep its routing graph in sync with on-chain state

## Quick Start

### Get a Quote (Mode 1)

```typescript
import { smartSwap } from "@zera-os/zera.js";

const quote = await smartSwap.getQuote({
  tokenIn: "$LEET+1337",
  tokenOut: "$sol-SOL+000000",
  amountIn: 10000000,
});

console.log(`Output: ${quote.amountOut} ${quote.tokenOut}`);
console.log(
  `Route: ${quote.stages?.length} stages, ${quote.hopDetails?.length} hops`,
);
```

### Build & Submit a Swap (Mode 2)

```typescript
const hash = await smartSwap.swapAndSend(
  {
    tokenIn: "$LEET+1337",
    tokenOut: "$sol-SOL+000000",
    amountIn: 10000000,
    minAmountOut: "0",
    feeContractID: "$ZRA+0000",
  },
  publicKey,
  privateKey,
  { grpcConfig },
);
```

### Two-Step: Quote → Build from Stages (Mode 3)

```typescript
// Step 1: Show the user a quote
const quote = await smartSwap.getQuote({
  tokenIn: "$LEET+1337",
  tokenOut: "$sol-SOL+000000",
  amountIn: 10000000,
});

// Step 2: On user confirmation, build from the same route
const hash = await smartSwap.swapFromStagesAndSend(
  {
    tokenIn: "$LEET+1337",
    tokenOut: "$sol-SOL+000000",
    amountIn: 10000000,
    minAmountOut: "0",
    feeContractID: "$ZRA+0000",
    stages: quote.stages,
  },
  publicKey,
  privateKey,
  { grpcConfig },
);
```

## API Reference

### Functions

| Function         | Description                                             |
| ---------------- | ------------------------------------------------------- |
| `getQuote`       | Get a price quote with routing details (no keys needed) |
| `swap`           | Build a swap transaction in one shot (Mode 2)           |
| `swapFromStages` | Build a swap from previously-fetched stages (Mode 3)    |

> **Tip:** `swap` and `swapFromStages` have `AndSend` variants that sign and submit in one call.

### The Three Modes

The indexer's `/v1/dex/swap` endpoint supports three call patterns:

| Mode             | What You Send                                        | What You Get                   | Use Case                           |
| ---------------- | ---------------------------------------------------- | ------------------------------ | ---------------------------------- |
| **Quote**        | `tokenIn`, `tokenOut`, `amountIn`                    | Price, route stages, slippage  | Price display, route preview       |
| **Direct Build** | + `includeTransaction`, `publicKey`, `feeContractID` | Quote + serialized transaction | One-shot swap execution            |
| **From Stages**  | + `stages` (from previous quote)                     | Serialized transaction         | Show quote first, build on confirm |

### Platform Fees

dApps can charge a platform fee on swaps:

```typescript
const quote = await smartSwap.getQuote({
  tokenIn: "$LEET+1337",
  tokenOut: "$sol-SOL+000000",
  amountIn: 10000000,
  platformFeeBps: 75, // 0.75%
  platformFeeAddress: "HhV1xV3RfaXCoxAyUQVxnpMtUaxLfds81D5JSGN7B2rB",
});
// quote.netAmountOut = output after fee
// quote.platformFee  = fee amount
```

### Fee Model

The ZERA DEX uses an **output-centric fee model** with a standard pool fee of **75 basis points** (0.75%), deducted from the output automatically.

## Indexer SDK Resolution

Smart Swap requires the `indexer-api-ts` SDK. There are two ways to use it:

### Option A: Direct import (npm)

If you've installed the published package:

```bash
npm install @visiondynamics/zera-indexer
```

```typescript
import { ZeraClient } from "@visiondynamics/zera-indexer";

const client = new ZeraClient({ baseUrl: "https://api.zerascan.io" });
const dex = client.v1.dex;
```

### Option B: Dynamic resolver (local-first)

The `resolve-indexer.ts` module handles resolution automatically:

1. **Local** — Checks for a sibling `indexer-api-ts` directory next to zera.js (the typical contributor setup)
2. **npm** — Falls back to `@visiondynamics/zera-indexer` from npm

```
Documents/GitHub/
├── zera.js/               ← this project
└── indexer-api-ts/        ← local SDK (checked first)
```

```typescript
import { resolveIndexerClient } from "./resolve-indexer.js";

const { ZeraClient } = await resolveIndexerClient();
const client = new ZeraClient({ baseUrl: "https://api.zerascan.io" });
const dex = client.v1.dex;
```

> The example uses Option B so it works out-of-the-box for both contributors and npm consumers.

> **⚠️ Mode 3 Note:** `swapFromStages` returns `{ type, data, version }` at the **top level**, not nested under `.transaction` like Mode 2.

## Module Structure

```
smart-swap/
├── README.md               # This file
├── index.ts                # Public API
├── types.ts                # Type definitions
├── resolve-indexer.ts      # Local-first SDK resolution
├── examples/
│   └── smart-swap-flows.ts # End-to-end example
```

## Examples

See [examples/smart-swap-flows.ts](./examples/smart-swap-flows.ts) for drop-in functions you can copy into your app:

| Function                   | What It Does                                   |
| -------------------------- | ---------------------------------------------- |
| `getQuote()`               | Get a price quote — no keys needed             |
| `getQuoteAndTransaction()` | Quote + serialized transaction in one call     |
| `quoteAndBuild()`          | Quote first, build from stages on user confirm |

_(Note: The example file also includes a `signAndSubmit` utility function to demonstrate how to sign and broadcast the built transactions.)_

Each function is independent — pick the one that fits your use case.
