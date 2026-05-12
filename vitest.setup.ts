// Global test setup is now handled in vitest.global-setup.ts
// This file is kept for any per-test-file setup if needed

// Mock gRPC modules for testing
import { vi } from 'vitest';

import { NetworkError } from './src/types/index.js';

// Mock @connectrpc/connect and @connectrpc/connect-web
vi.mock('@connectrpc/connect', () => ({
  createClient: vi.fn(() => ({
    // Mock Transaction Service methods
    coin: vi.fn().mockResolvedValue({}),
    governVote: vi.fn().mockResolvedValue({}),
    smartContractExecute: vi.fn().mockResolvedValue({}),
    contract: vi.fn().mockResolvedValue({}),
    contractUpdate: vi.fn().mockResolvedValue({}),
    itemMint: vi.fn().mockResolvedValue({}),
    nFT: vi.fn().mockResolvedValue({}),
    burnSBT: vi.fn().mockResolvedValue({}),
    
    // Mock API Service methods
    nonce: vi.fn().mockResolvedValue({ nonce: '0' }),
    tokenFeeInfo: vi.fn().mockResolvedValue({}),
    getTokenFeeInfo: vi.fn().mockResolvedValue({
      tokens: [
        {
          contractId: '$ZRA+0000',
          rate: '1000000000000000000',
          authorized: true,
          denomination: '1000000000',
          contractFees: {
            fee: '1000000',
            burn: '500000',
            validator: '500000'
          },
          allowedFees: '0',
          usedFees: '0'
        }
      ]
    })
  })),
  Client: {}
}));

vi.mock('@connectrpc/connect-web', () => ({
  createGrpcWebTransport: vi.fn(() => ({}))
}));

// Mock the entire gRPC client creation
vi.mock('./src/grpc/generic-grpc-client.js', () => ({
  createGenericGRPCClient: vi.fn((options) => {
    // Handle invalid proto files
    if (options.protoFile === 'invalid.proto') {
      throw new NetworkError('Invalid proto file', {
        operation: 'createGenericGRPCClient',
        module: 'grpc',
        details: { protoFile: 'invalid.proto' }
      });
    }
    
    // Handle invalid package names
    if (options.packageName === 'invalid_package') {
      throw new NetworkError('Package not found', {
        operation: 'createGenericGRPCClient',
        module: 'grpc',
        details: { packageName: 'invalid_package' }
      });
    }
    
    // Handle invalid service names
    if (options.serviceName === 'InvalidService') {
      throw new NetworkError('Service not found', {
        operation: 'createGenericGRPCClient',
        module: 'grpc',
        details: { serviceName: 'InvalidService' }
      });
    }
    
    // Return a mock client that throws network errors for specific hosts
    if (options.host === 'invalid-host' || options.host === 'test-failure-host') {
      return {
        client: {
          Nonce: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
            operation: 'Nonce',
            module: 'grpc',
            details: { host: options.host, port: options.port }
          })),
          TokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
            operation: 'TokenFeeInfo',
            module: 'grpc',
            details: { host: options.host, port: options.port }
          })),
          GetTokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
            operation: 'GetTokenFeeInfo',
            module: 'grpc',
            details: { host: options.host, port: options.port }
          })),
          submitCoinTransaction: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
            operation: 'submitCoinTransaction',
            module: 'grpc',
            details: { host: options.host, port: options.port }
          }))
        },
        proto: {},
        host: options.host || 'localhost',
        port: options.port,
        serviceName: options.serviceName || 'APIService'
      };
    }
    
    if (options.timeout === 1) {
      return {
        client: {
          Nonce: vi.fn().mockRejectedValue(new NetworkError('Request timeout', {
            operation: 'Nonce',
            module: 'grpc',
            details: { timeout: 1 }
          })),
          TokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Request timeout', {
            operation: 'TokenFeeInfo',
            module: 'grpc',
            details: { timeout: 1 }
          }))
        },
        proto: {},
        host: options.host || 'localhost',
        port: options.port,
        serviceName: options.serviceName || 'APIService'
      };
    }
    
    // Default behavior: return successful responses for business logic tests
    // gRPC infrastructure tests will override this with specific error scenarios
    return {
      client: {
        Nonce: vi.fn().mockResolvedValue({ nonce: 0 }),
        TokenFeeInfo: vi.fn().mockResolvedValue({}),
        GetTokenFeeInfo: vi.fn().mockResolvedValue({
          tokens: [
            {
              contractId: '$ZRA+0000',
              rate: '1000000000000000000', // 1e18 scale
              authorized: true,
              denomination: '1000000000', // 1e9 (9 decimal places)
              contractFees: {
                fee: '1000000', // 0.001 ZRA in smallest units
                burn: '500000', // 0.0005 ZRA in smallest units
                validator: '500000' // 0.0005 ZRA in smallest units
              },
              allowedFees: '0',
              usedFees: '0'
            }
          ]
        }),
        submitCoinTransaction: vi.fn().mockResolvedValue({ success: true })
      },
      proto: {},
      host: options.host,
      port: options.port,
      serviceName: options.serviceName
    };
  }),
  makeGRPCCall: vi.fn((client, method, request) => {
    if (client[method]) {
      return client[method](request);
    }
    throw new NetworkError(`Method '${method}' not found on client. Available methods: ${Object.keys(client).join(', ')}`, {
      operation: 'makeGRPCCall',
      module: 'grpc',
      details: { method, availableMethods: Object.keys(client) }
    });
  })
}));

// Mock @grpc/grpc-js
vi.mock('@grpc/grpc-js', () => ({
  loadPackageDefinition: vi.fn((packageDefinition) => {
    // Check if it's an invalid proto file
    if (packageDefinition && Object.keys(packageDefinition).length === 0) {
      return {}; // Return empty for invalid proto files
    }
    
    return {
      zera_api: {
        APIService: vi.fn((options) => {
          // Simulate network errors for invalid hosts
          if (options.host === 'invalid-host') {
            return {
              getNonce: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
                operation: 'getNonce',
                module: 'grpc',
                details: { host: 'invalid-host', port: 9999 }
              })),
              getTokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
                operation: 'getTokenFeeInfo',
                module: 'grpc',
                details: { host: 'invalid-host', port: 9999 }
              })),
              Nonce: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
                operation: 'Nonce',
                module: 'grpc',
                details: { host: 'invalid-host', port: 9999 }
              })),
              TokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Connection failed', {
                operation: 'TokenFeeInfo',
                module: 'grpc',
                details: { host: 'invalid-host', port: 9999 }
              }))
            };
          }
          
          // Simulate timeout errors for very short timeouts
          if (options.timeout === 1) {
            return {
              getNonce: vi.fn().mockRejectedValue(new NetworkError('Request timeout', {
                operation: 'getNonce',
                module: 'grpc',
                details: { timeout: 1 }
              })),
              getTokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Request timeout', {
                operation: 'getTokenFeeInfo',
                module: 'grpc',
                details: { timeout: 1 }
              })),
              Nonce: vi.fn().mockRejectedValue(new NetworkError('Request timeout', {
                operation: 'Nonce',
                module: 'grpc',
                details: { timeout: 1 }
              })),
              TokenFeeInfo: vi.fn().mockRejectedValue(new NetworkError('Request timeout', {
                operation: 'TokenFeeInfo',
                module: 'grpc',
                details: { timeout: 1 }
              }))
            };
          }
          
          return {
            getNonce: vi.fn(),
            getTokenFeeInfo: vi.fn(),
            Nonce: vi.fn(),
            TokenFeeInfo: vi.fn()
          };
        })
      },
      zera_txn: {
        TransactionService: vi.fn(() => ({
          submitTransaction: vi.fn()
        })),
        TXNService: vi.fn(() => ({
          submitTransaction: vi.fn()
        }))
      },
      zera_validator: {
        ValidatorService: vi.fn(() => ({
          getValidatorInfo: vi.fn()
        }))
      }
    };
  }),
  credentials: {
    createInsecure: vi.fn(() => ({})),
    createSsl: vi.fn(() => ({}))
  },
  status: {
    OK: 0,
    CANCELLED: 1,
    UNKNOWN: 2,
    INVALID_ARGUMENT: 3,
    DEADLINE_EXCEEDED: 4,
    NOT_FOUND: 5,
    ALREADY_EXISTS: 6,
    PERMISSION_DENIED: 7,
    RESOURCE_EXHAUSTED: 8,
    FAILED_PRECONDITION: 9,
    ABORTED: 10,
    OUT_OF_RANGE: 11,
    UNIMPLEMENTED: 12,
    INTERNAL: 13,
    UNAVAILABLE: 14,
    DATA_LOSS: 15,
    UNAUTHENTICATED: 16
  }
}));

// Mock @grpc/proto-loader
vi.mock('@grpc/proto-loader', () => ({
  loadSync: vi.fn((protoFile) => {
    // Return empty for invalid proto files
    if (protoFile === 'invalid.proto') {
      return {};
    }
    return {
      zera_api: {},
      zera_txn: {},
      zera_validator: {}
    };
  }),
  load: vi.fn((protoFile) => {
    // Return empty for invalid proto files
    if (protoFile === 'invalid.proto') {
      return Promise.resolve({});
    }
    return Promise.resolve({
      zera_api: {},
      zera_txn: {},
      zera_validator: {}
    });
  })
}));
