# ZERA Wallet Adapter — Integration Guide

Connect your site to ZERA wallets with a few lines of code using `@zera-os/zera.js`.

---

## Install

```bash
npm install @zera-os/zera.js
```

---

## Quickstart

```typescript
import {
  ZeraWalletAdapter,
  buildVoteTXN,
  signAndFinalize,
  sendVoteTXN,
} from "@zera-os/zera.js";

// 1. Connect
const adapter = new ZeraWalletAdapter();
await adapter.connect();
console.log("Connected:", adapter.publicKey);

// 2. Build an unsigned transaction
const txn = await buildVoteTXN({
  publicKeyId: adapter.publicKey!,
  contractId: "$GOVERNANCE+0000",
  proposalHash: "abc123...",
  option: "Yes",
});

// 3. Sign via wallet (no private keys needed)
const signed = await signAndFinalize(txn, adapter.signer!);

// 4. Submit
const hash = await sendVoteTXN(signed);
console.log("Vote submitted:", hash);

// 5. Disconnect
await adapter.disconnect();
```

---

## How It Works

```
Your dApp                         VisionHub
────────                         ──────────
adapter.connect()
  └─→ window.zera.request('zera_requestAccounts')
       └─→ Approval Modal ─── User approves
            └─→ Returns public key

adapter.signer.sign(txnBytes)
  └─→ window.zera.request('zera_signTransaction')
       └─→ Auth Gate (PIN / Biometric) ─── User authenticates
            └─→ Signs with private key
                 └─→ Returns signature
```

The `ZeraWalletAdapter` detects `window.zera` (injected by VisionHub's dApp browser)
and produces a `WalletSigner` that implements the SDK's `ZeraSigner` interface.
This means all existing SDK functions like `signAndFinalize()` work seamlessly.

---

## API Reference

### `ZeraWalletAdapter`

```typescript
const adapter = new ZeraWalletAdapter(config?: WalletAdapterConfig);
```

| Config        | Type    | Default          | Description                   |
| ------------- | ------- | ---------------- | ----------------------------- |
| `autoConnect` | boolean | `false`          | Auto-connect on creation      |
| `deepLinkUrl` | string  | `'visionhub://'` | Deep link for mobile redirect |
| `signTimeout` | number  | `300000` (5 min) | Signing request timeout (ms)  |

#### Properties

| Property     | Type                   | Description                                     |
| ------------ | ---------------------- | ----------------------------------------------- |
| `connected`  | `boolean`              | Whether wallet is connected                     |
| `publicKey`  | `string \| null`       | Connected wallet's public key                   |
| `signer`     | `WalletSigner \| null` | ZeraSigner for use with `signAndFinalize`       |
| `state`      | `WalletAdapterState`   | `'disconnected' \| 'connecting' \| 'connected'` |
| `isEmbedded` | `boolean`              | True if inside VisionHub dApp browser           |

#### Methods

| Method                | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `connect()`           | Detect provider, request accounts, returns public key    |
| `disconnect()`        | Disconnect and clear state                               |
| `on(event, handler)`  | Listen for `'connect'`, `'disconnect'`, `'error'` events |
| `off(event, handler)` | Remove event listener                                    |
| `getDeepLink(url?)`   | Generate VisionHub deep link for the given URL           |

#### Static Methods

| Method                               | Description                           |
| ------------------------------------ | ------------------------------------- |
| `ZeraWalletAdapter.isAvailable()`    | Check if a ZERA provider is available |
| `ZeraWalletAdapter.truncateKey(key)` | Truncate a key for display            |

---

## React Integration

```tsx
import { useState, useEffect, useCallback } from "react";
import { ZeraWalletAdapter } from "@zera-os/zera.js";

// Custom hook
function useZeraWallet() {
  const [adapter] = useState(() => new ZeraWalletAdapter());
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    adapter.on("connect", ({ publicKey }: any) => {
      setConnected(true);
      setPublicKey(publicKey);
    });
    adapter.on("disconnect", () => {
      setConnected(false);
      setPublicKey(null);
    });
    return () => {
      adapter.disconnect();
    };
  }, [adapter]);

  const connect = useCallback(() => adapter.connect(), [adapter]);
  const disconnect = useCallback(() => adapter.disconnect(), [adapter]);

  return { adapter, connected, publicKey, connect, disconnect };
}

// Usage in a component
function VoteButton({ proposalHash }: { proposalHash: string }) {
  const { adapter, connected, publicKey, connect } = useZeraWallet();

  const handleVote = async () => {
    if (!connected) await connect();

    const txn = await buildVoteTXN({
      publicKeyId: adapter.publicKey!,
      contractId: "$GOVERNANCE+0000",
      proposalHash,
      option: "Yes",
    });

    const signed = await signAndFinalize(txn, adapter.signer!);
    await sendVoteTXN(signed);
  };

  return (
    <button onClick={connected ? handleVote : connect}>
      {connected ? "Cast Vote" : "Connect Wallet"}
    </button>
  );
}
```

---

## Vanilla JavaScript

```html
<button id="connect">Connect Wallet</button>
<button id="vote" disabled>Vote</button>

<script type="module">
  import {
    ZeraWalletAdapter,
    buildVoteTXN,
    signAndFinalize,
    sendVoteTXN,
  } from "@zera-os/zera.js";

  const adapter = new ZeraWalletAdapter();

  document.getElementById("connect").onclick = async () => {
    await adapter.connect();
    document.getElementById("vote").disabled = false;
    document.getElementById("connect").textContent = adapter.publicKey;
  };

  document.getElementById("vote").onclick = async () => {
    const txn = await buildVoteTXN({
      /* ... */
    });
    const signed = await signAndFinalize(txn, adapter.signer);
    await sendVoteTXN(signed);
    alert("Vote submitted!");
  };
</script>
```

---

## Desktop Fallback

When not inside VisionHub's dApp browser, redirect users:

```typescript
const adapter = new ZeraWalletAdapter();

if (!ZeraWalletAdapter.isAvailable()) {
  // Redirect to VisionHub with this page's URL
  window.location.href = adapter.getDeepLink();
} else {
  await adapter.connect();
}
```

---

## Transaction Types

The adapter works with **all** SDK transaction builders:

| Builder                          | Use Case             |
| -------------------------------- | -------------------- |
| `buildCoinTXN()`                 | Token transfers      |
| `buildVoteTXN()`                 | Governance voting    |
| `buildContractTXN()`             | Contract deployment  |
| `buildContractUpdateTXN()`       | Contract updates     |
| `buildSmartContractExecuteTXN()` | Smart contract calls |

The pattern is always the same:

```typescript
const txn = await buildXxxTXN({ publicKeyId: adapter.publicKey!, ... });
const signed = await signAndFinalize(txn, adapter.signer!);
await sendXxxTXN(signed);
```
