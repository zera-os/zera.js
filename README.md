<p align="center">
  <strong>zera.js</strong>
</p>

<p align="center">
  The Leading JavaScript SDK for the ZERA Network
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zera-os/zera.js"><img src="https://img.shields.io/npm/v/@zera-os/zera.js?style=flat-square&color=0a0a0a" alt="npm version"></a>
  <a href="https://github.com/zera-os/zera.js/blob/main/LICENSE"><img src="https://img.shields.io/github/license/zera-os/zera.js?style=flat-square&color=0a0a0a" alt="license"></a>
  <a href="https://www.npmjs.com/package/@zera-os/zera.js"><img src="https://img.shields.io/npm/dm/@zera-os/zera.js?style=flat-square&color=0a0a0a" alt="downloads"></a>
</p>

---

Build wallets. Send transactions. Deploy contracts. Bridge cross-chain. And More. All from JavaScript.

`zera.js` is a typed, modular SDK that gives you tools to build on the ZERA Network — from HD wallet generation to DEX operations to cross-chain bridging with Solana. It works in Node.js, React Native, and modern browsers.

```bash
npm install @zera-os/zera.js
```

## Quick Start

```typescript
import {
  createWallet,
  createCoinTXN,
  submitTransaction,
} from "@zera-os/zera.js";

// Create an HD wallet
const wallet = await createWallet({
  keyType: "ed25519",
  hashType: "sha3",
});

// Build a transaction
const txn = await createCoinTXN(
  [{ address: wallet.address, amount: "100" }],
  [{ address: recipientAddress, amount: "100" }],
  "$ZRA+0000",
);

// Submit to the network
await submitTransaction(txn);
```

## What You Can Build

**Wallets** — Generate BIP39 mnemonic phrases, derive HD wallets with SLIP-0010, support Ed25519 and Ed448 key types.

**Transactions** — Build, sign, and submit coin transfers with automatic fee calculation, multi-input/output support, and token allowances.

**Smart Contracts** — Create, update, and execute smart contracts with typed parameters.

**DEX** — Create liquidity pools, add/remove liquidity, execute swaps, and manage LP tokens.

**Cross-Chain Bridge** — Lock and unlock assets between ZERA and Solana with guardian support.

**Governance** — Cast votes on network proposals.

**Network Queries** — Fetch balances, nonces, exchange rates, and token information from validators.

## Architecture

The SDK is organized into focused, independently documented modules. Each module contains its own README and runnable examples. Below for illustrative purposes only and may not be current:

```
src/
├── wallet-creation/     HD wallet generation & key management
├── coin-txn/            Transaction building & signing
├── contract/            Smart contract creation & updates
├── smart-contracts/     Contract execution & use cases
│   └── use-cases/
│       ├── dex/         Pools, liquidity, swaps
│       ├── bridge/      ZERA ↔ Solana bridging
│       └── staking/     Staking operations
├── vote/                Governance voting
├── sign/                Universal signing interface
├── adapter/             Wallet adapters & serialization
├── api/                 Validator API clients
├── grpc/                ConnectRPC transport layer
└── shared/              Crypto primitives, validation, utilities
```

## Module Documentation

Each module has its own detailed docs. Start with whatever you're building:

| Building...          | Start here                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Wallets & keys       | [`src/wallet-creation/README.md`](./src/wallet-creation/README.md)                                   |
| Coin transfers       | [`src/coin-txn/README.md`](./src/coin-txn/README.md)                                                 |
| DEX integrations     | [`src/smart-contracts/use-cases/dex/README.md`](./src/smart-contracts/use-cases/dex/README.md)       |
| Cross-chain bridging | [`src/smart-contracts/use-cases/bridge/README.md`](./src/smart-contracts/use-cases/bridge/README.md) |
| Network queries      | [`src/api/README.md`](./src/api/README.md)                                                           |
| gRPC transport       | [`src/grpc/README.md`](./src/grpc/README.md)                                                         |
| Shared utilities     | [`src/shared/README.md`](./src/shared/README.md)                                                     |

## Running Examples

Most modules include an `examples/` directory with code you can run directly:

```bash
npx tsx src/wallet-creation/examples/basic-usage.ts
npx tsx src/coin-txn/examples/real-world-usage.ts
npx tsx src/smart-contracts/use-cases/dex/examples/dex-operations.ts
npx tsx src/vote/examples/basic-vote-example.ts
```

## Cryptography

The SDK uses audited, standards-compliant cryptographic libraries — no custom crypto.

| Standard  | Purpose                            |
| --------- | ---------------------------------- |
| Ed25519   | Default signing (FIPS 186-4)       |
| Ed448     | High-security signing (FIPS 186-5) |
| SHA3      | Address hashing (FIPS 202)         |
| BLAKE3    | High-performance hashing           |
| BIP39     | Mnemonic phrase generation         |
| SLIP-0010 | EdDSA HD key derivation            |

Key pairs and signatures are handled by [`@noble/curves`](https://github.com/paulmillr/noble-curves) and [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) — independently audited, zero-dependency libraries.

## Development

```bash
npm install            # Install dependencies
npm run build:proto    # Generate protobuf types
npm run build          # Build the SDK
npm test               # Run the test suite
npm run type-check     # Verify types
npm run lint           # Lint the codebase
```

The SDK builds to both CommonJS and ESM targets with full TypeScript declarations.

## Contributing

ZERA-OS is community-run. There's no company behind it, no inner circle, no gatekeeping.

If you can write code, review a PR, file an issue, or share an idea — you belong here. Consistent contributors are invited to become maintainers.

> The more builders there are, the stronger this tooling becomes. Start anywhere. Start today.

## License

[Apache 2.0](./LICENSE) — ZERA Community
