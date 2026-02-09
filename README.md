# zera.js

JavaScript SDK for the ZERA Network.

## Overview

`zera.js` provides everything you need to build on ZERA — wallet creation, transactions, smart contracts, DEX operations, cross-chain bridging, and governance voting. Written in TypeScript with full type safety.

## Installation

```bash
npm install @zera-os/zera.js
```

> Works with Node.js, React Native, and modern browsers.

## Project Structure

Most modules include a `README.md` with documentation and an `examples/` directory with runnable code you can execute directly with `tsx`.

```
src/
├── wallet-creation/        # HD wallet generation & key management
│   └── examples/           #   → basic-usage.ts
│
├── coin-txn/               # Transaction building & signing
│   └── examples/           #   → real-world-usage.ts
│
├── contract/               # Smart contract creation & updates
│   ├── create/examples/    #   → full contract creation example
│   └── update/examples/    #   → contract update example
│
├── smart-contracts/        # Smart contract execution
│   └── use-cases/
│       ├── dex/            # DEX: pools, liquidity, swaps, LP
│       │   └── examples/   #   → dex-operations.ts
│       └── bridge/         # Cross-chain: ZERA ↔ Solana
│           ├── zera/examples/
│           ├── solana/examples/
│           └── guardian/examples/
│
├── vote/                   # Governance proposal voting
│   └── examples/           #   → basic-vote-example.ts
│
├── api/                    # Validator API (nonce, fees, balances)
│   └── validator/
│       ├── balance/examples/
│       ├── fee-info/examples/
│       └── nonce/examples/
│
├── grpc/                   # ConnectRPC transport layer
│   └── examples/           #   → universal-grpc-examples.ts
│
└── shared/                 # Crypto utils, validation, monitoring
    └── utils/examples/
```

### Running Examples

```bash
npx tsx src/wallet-creation/examples/basic-usage.ts
npx tsx src/coin-txn/examples/real-world-usage.ts
npx tsx src/smart-contracts/use-cases/dex/examples/dex-operations.ts
```

## Module Documentation

| Module          | README                                                     | What it covers                                             |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Wallet Creation | [README](./src/wallet-creation/README.md)                  | BIP39 mnemonics, Ed25519 & Ed448, SLIP-0010, HD derivation |
| Transactions    | [README](./src/coin-txn/README.md)                         | Transfers, multi-input/output, allowances, auto fee calc   |
| DEX             | [README](./src/smart-contracts/use-cases/dex/README.md)    | Pool creation, liquidity, swaps, LP management             |
| Bridge          | [README](./src/smart-contracts/use-cases/bridge/README.md) | Cross-chain transfers between ZERA and Solana              |
| API             | [README](./src/api/README.md)                              | Validator API, nonce, token info, fee queries              |
| gRPC            | [README](./src/grpc/README.md)                             | ConnectRPC transport, protobuf clients                     |
| Shared          | [README](./src/shared/README.md)                           | Crypto, validation, monitoring                             |

## Development

```bash
# Install dependencies
npm install

# Generate protobuf types
npm run build:proto

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## Cryptographic Standards

| Standard  | Usage                                   |
| --------- | --------------------------------------- |
| Ed25519   | Default signing (NIST FIPS 186-4)       |
| Ed448     | High-security signing (NIST FIPS 186-5) |
| SHA3      | Address hashing (NIST FIPS 202)         |
| BLAKE3    | High-performance hashing                |
| BIP39     | Mnemonic generation                     |
| SLIP-0010 | EdDSA HD wallet derivation              |

## License

[MIT](./LICENSE) — ZERA Community
