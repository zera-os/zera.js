# API Services

This module provides API services for interacting with ZERA Network validators.

## What it does

- Connects to validator nodes
- Retrieves network information
- Manages nonces and fees

## Key Services

### Validator API (`validator/`)

- Nonce management
- Fee information
- Network status
- Transaction validation

### ZV Indexer (`zv-indexer/`)

- Third-party indexing service
- Real-time blockchain data
- Historical transaction data
- Advanced querying

## Usage

```typescript
import { getNonces } from "./validator/nonce/service.js";
import { getFeeInfo } from "./validator/fee-info/service.js";

// Get nonces for addresses
const nonces = await getNonces(["address1", "address2"]);

// Get fee information
const feeInfo = await getFeeInfo("$ZRA+0000");
```

## Configuration

Services use gRPC configuration:

- Host and port settings
- Timeout values
- Retry policies
- Authentication

## Examples

See service-specific examples in each subdirectory.

## Testing

Run tests with:

```bash
npm run test:api
```
