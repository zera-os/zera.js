# ZERA ↔ Solana Bridge SDK

Complete SDK for cross-chain token transfers between ZERA and Solana networks.

## Quick Start

### Lock SPL Tokens (Solana → ZERA)

```typescript
import { Connection, Keypair } from "@solana/web3.js";
import { solana } from "@zera-os/zera.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const wallet = Keypair.fromSecretKey(yourSecretKey);

// Build lock transaction
const { transaction } = await solana.buildLockSplTransaction(
  {
    amount: BigInt(1_000_000), // 1 USDC (6 decimals)
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    zeraAddress: "your-zera-address",
  },
  wallet.publicKey,
  connection,
);

// Sign and send
transaction.sign(wallet);
const sig = await connection.sendRawTransaction(transaction.serialize());
```

### Lock Native SOL (Solana → ZERA)

```typescript
const { transaction } = await solana.buildLockSolTransaction(
  {
    amount: BigInt(1_000_000_000), // 1 SOL
    zeraAddress: "your-zera-address",
  },
  wallet.publicKey,
  connection,
);
```

## Transaction Builders

### User Operations

| Function                      | Direction     | Description              |
| ----------------------------- | ------------- | ------------------------ |
| `buildLockSplTransaction`     | Solana → ZERA | Lock SPL tokens          |
| `buildLockSolTransaction`     | Solana → ZERA | Lock native SOL          |
| `buildBurnWrappedTransaction` | Solana → ZERA | Burn wrapped ZERA tokens |

### Guardian Operations

| Function                              | Direction     | Description                               |
| ------------------------------------- | ------------- | ----------------------------------------- |
| `buildReleaseSplTransaction`          | ZERA → Solana | Release locked SPL tokens (including SOL) |
| `buildMintWrappedTransaction`         | ZERA → Solana | Mint wrapped tokens (first-time)          |
| `buildMintWrappedExistingTransaction` | ZERA → Solana | Mint wrapped tokens (existing)            |
| `buildRegisterTokenTransaction`       | -             | Register new token with bridge            |

## Guardian Service

Query the guardian service for attestations:

```typescript
import { guardian } from "@zera-os/zera.js";

const client = guardian.createGuardianClient();

// Get payload by transaction hash
const payload = await client.getPayload(
  guardian.GetPayloadRequest.create({
    txnHash: "zera-tx-hash",
    networkType: guardian.NETWORK_TYPE.ZERA,
  }),
);

// Search recent payloads
const results = await client.searchPayload(
  guardian.SearchPayloadRequest.create({
    searchStartTime: BigInt(Date.now() - 86400000),
  }),
);
```

## PDA Derivation

```typescript
import { solana } from "@zera-os/zera.js";

// Bridge PDAs
const [routerSigner] = solana.deriveRouterSignerPDA();
const [vault] = solana.deriveVaultPDA();

// Token PDAs
const [registration] = solana.deriveTokenRegistrationPDA(mint);
const [wrappedMint] = solana.deriveWrappedMintPDA("$ZRA+0000");

// Associated Token Account
const ata = solana.getATA(owner, mint);
```

## Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   ZERA      │         │  Guardians  │         │   Solana    │
│   Chain     │◄───────►│   (VAA)     │◄───────►│   Chain     │
└─────────────┘         └─────────────┘         └─────────────┘
      │                       │                       │
      │  1. Lock on ZERA      │                       │
      │ ──────────────────────►                       │
      │                       │  2. Sign VAA          │
      │                       │ ──────────────────────►
      │                       │                       │  3. Release on Solana
```

## Examples

See [examples/bridge-e2e.ts](./solana/examples/bridge-e2e.ts) for complete end-to-end examples.
