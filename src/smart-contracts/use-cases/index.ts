/**
 * Smart Contract Use Cases - Public API
 * 
 * This module provides high-level use case implementations for common
 * smart contract interactions on the ZERA network.
 * 
 * ## Available Use Cases
 * 
 * ### Bridge
 * Cross-chain token bridging between ZERA and other chains (Solana).
 * - ZERA side: Lock tokens to bridge out
 * - Solana side: Release/lock tokens, mint/burn wrapped tokens
 * - Guardian: Administrative operations
 * 
 * ### DEX
 * Decentralized exchange operations via the `zera_dex_proxy` contract.
 * - Pool management: Create, add/remove/unlock liquidity
 * - Trading: Token swaps with configurable slippage
 */

export * as bridge from './bridge/index.js';
export * as dex from './dex/index.js';
