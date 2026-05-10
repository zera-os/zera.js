import type { GRPCConfig } from '../../../types/index.js';

/**
 * Sample GRPC configuration -- select your GRPC endpoint
 */
export const MAINNET_GRPC_CONFIG: GRPCConfig = {
  host: 'mainnet.zerascan.io',
  protocol: 'https',
  fallbackToHttp: true
};

export const TESTNET_GRPC_CONFIG: GRPCConfig = {
  host: 'testnet.zerascan.io',
  protocol: 'https',
  fallbackToHttp: true
};

export const PROTONET_GRPC_CONFIG: GRPCConfig = {
  host: 'protonet.zerascan.io',
  protocol: 'https',
  fallbackToHttp: true
};

