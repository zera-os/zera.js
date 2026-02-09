# ZERA Network Client (ConnectRPC)

This module provides a robust client for connecting to ZERA Network services using [ConnectRPC](https://connectrpc.com/). It utilizes gRPC-Web to ensure compatibility across Node.js and browser environments without requiring complex proxies.

## What it does

- Creates strongly-typed clients for ZERA Network services (Validator API, Transaction Service).
- Handles network communication with automatic fallback (HTTPS -> HTTP).
- Supports both browser and Node.js environments.

## Key Features

- **ConnectRPC**: Uses the modern ConnectRPC protocol over gRPC-Web.
- **Automatic Fallback**: Defaults to secure `mainnet.zerascan.io` (443/HTTPS). If the connection fails, it automatically attempts a fallback to port 8080 (HTTP) to ensure reliability.
- **Zero-Config Defaults**: Works out of the box for Mainnet.
- **Type-Safe**: Full TypeScript support with generated Protocol Buffer types.

## Usage

### Basic (Mainnet)

```typescript
import { createValidatorAPIClient } from './api/validator-api-client.js';

// Connects to mainnet.zerascan.io:443 by default
const client = createValidatorAPIClient();

// Make API calls
const nonce = await client.getNonce('B194kxJZ9cH8G3JKF7LuPQLaRsBrC5JrnpGNQRQXm1M2');
console.log(nonce);
```

### Custom Configuration

You can override the host, port, or disable fallback behavior.

```typescript
import { createValidatorAPIClient } from './api/validator-api-client.js';

const client = createValidatorAPIClient({
  host: 'testnet.zerascan.io', // Custom host
  // port: 443,                // Optional: defaults to 443 for HTTPS
  // protocol: 'https',        // Optional: defaults to 'https'
  // fallbackToHttp: false     // Optional: disable auto-fallback to HTTP
});
```

## Client Types

- **Validator API Client**: For querying state (balances, nonces, fee info).
- **Transaction Client**: For submitting transactions (coins, contracts, votes).

## Examples

See `examples/universal-grpc-examples.ts` for complete examples.

## Testing

Run tests with:
```bash
npm run test:grpc
```