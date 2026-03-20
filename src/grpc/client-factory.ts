/* eslint-disable no-undef */
import type { ServiceType } from '@bufbuild/protobuf';
import { ConnectError, createPromiseClient, type Interceptor, type PromiseClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';

import { logger } from '../shared/monitoring/index.js';
import type { GRPCConfig } from '../types/index.js';

import { createGrpcWebFetch } from './utils/grpc-web-fetch-wrapper.js';

/**
 * Universal gRPC error normalizer.
 *
 * ConnectRPC throws `ConnectError` objects whose properties are non-enumerable,
 * causing `console.error(err)` to print `{}`.  This interceptor converts every
 * ConnectError into a standard `Error` with a human-readable message so that
 * callers (bridge, swap, send, governance, etc.) always get useful diagnostics.
 */
const errorNormalizer: Interceptor = (next) => async (req) => {
  try {
    return await next(req);
  } catch (err) {
    if (err instanceof ConnectError) {
      const readable = new Error(
        `gRPC ${req.method.name} failed: [${err.code}] ${err.rawMessage || err.message}`
      );
      (readable as any).cause = err;  // preserve original for deep inspection
      throw readable;
    }
    throw err;
  }
};

/**
 * Mapping of protobuf service names to desired URL prefixes/service names.
 * This allows hitting /api/Nonce instead of /zera_api.APIService/Nonce,
 * /txn/Coin instead of /zera_txn.TXNService/Coin, and
 * /validator/... for ValidatorService.
 */
const SERVICE_TYPE_NAME_MAPPING: Record<string, string> = {
  'zera_api.APIService': 'api',
  'zera_txn.TXNService': 'txn',
  'zera_validator.ValidatorService': 'validator',
  'zera_guardian.GuardianService': 'guardian'
};


/**
 * Create a ConnectRPC client for the given service
 * 
 * @param service - The service definition (from generated proto)
 * @param config - Configuration options
 * @returns A PromiseClient for the service
 */
export function createClient<T extends ServiceType>(
  service: T,
  config: GRPCConfig = {}
): PromiseClient<T> {
  if (config.transport) {
    return createPromiseClient(service, config.transport);
  }

  // Default configuration: mainnet.zerascan.io over HTTPS (443)
  const host = config.host || 'mainnet.zerascan.io';
  const port = config.port || 443;
  const protocol = config.protocol || 'https';
  const servicePath = SERVICE_TYPE_NAME_MAPPING[service.typeName];

  // Normalize endpoint: ensure protocol is present even if caller passes a bare hostname
  const hasProtocol = (value: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  let baseUrl = config.endpoint || `${protocol}://${host}:${port}`;
  if (!hasProtocol(baseUrl)) {
    baseUrl = `${protocol}://${baseUrl}`;
  }

  // Try to parse the URL so downstream fetch/fallback always receives a valid absolute URL
  let actualHostname = host;
  try {
    const baseUrlObj = new URL(baseUrl);
    if (config.port && !baseUrlObj.port) {
      baseUrlObj.port = String(config.port);
    }
    baseUrl = baseUrlObj.toString();
    actualHostname = baseUrlObj.hostname;
  } catch {
    // Fall back to defaults if a malformed endpoint was provided
    baseUrl = `${protocol}://${host}:${port}`;
  }
  
  // Normalize baseUrl: remove trailing slashes to prevent double slashes in path construction
  // ConnectRPC will add the necessary slashes when constructing the full URL
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // If the endpoint already includes a service path (e.g., /api, /txn, /validator),
  // remove it since the service mapping will add it back
  // This prevents URLs like: mainnet.zerascan.io/api//GetTokenFeeInfo
  if (servicePath) {
    const pathToRemove = `/${servicePath.replace(/\/$/, '')}`;
    if (baseUrl.endsWith(pathToRemove)) {
      baseUrl = baseUrl.slice(0, -pathToRemove.length);
    }
  }

  // Fallback configuration
  const fallbackEnabled = config.fallbackToHttp !== false; // Defaults to true
  const fallbackPort = config.fallbackPort || 8080;

  // Logic to handle rejectUnauthorized for Node.js environment
  const baseFetch = config.fetch || globalThis.fetch;

  // Wrapper fetch for fallback logic
  const retryingFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Extract and log the full URL being used
    let fullUrl = '';
    if (typeof input === 'string') {
      fullUrl = input;
    } else if (input instanceof URL) {
      fullUrl = input.toString();
    } else if (typeof input === 'object' && input !== null && 'url' in input) {
      fullUrl = input.url;
    }
    
    // Always log the complete URL being used for every request
    console.log('ConnectRPC request URL', {
      operation: 'connectRpcRequest',
      module: 'grpc-client-factory',
      fullUrl: fullUrl,
      baseUrl: baseUrl,
      serviceTypeName: service.typeName,
      method: init?.method || 'POST',
      hostname: actualHostname
    });
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (baseFetch as any)(input, init);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      // Log response body for debugging (Connect protocol should handle this safely)
      const clonedResponse = response.clone();
      try {
        const bodyText = await clonedResponse.text();
        console.log('Response body:', bodyText.substring(0, 500)); // Log first 500 chars
      } catch (bodyError) {
        console.log('Could not read response body:', bodyError);
      }

      return response;
    } catch (error) {
      // Attempt fallback if enabled, using HTTPS, and request failed
      if (fallbackEnabled && protocol === 'https') {
        let urlStr = '';
        if (typeof input === 'string') {
          urlStr = input;
        } else if (input instanceof URL) {
          urlStr = input.toString();
        } else if (typeof input === 'object' && input !== null && 'url' in input) {
          // Handle Request object
          urlStr = input.url;
        }

        // Only retry if we can determine the URL and it matches our target host
        if (urlStr) {
          try {
            const requestUrl = new URL(urlStr);
            // Compare against the actual hostname from baseUrl (not the default host)
            // This ensures fallback works even when a custom endpoint is provided
            if (requestUrl.hostname === actualHostname) {
              // Construct fallback URL: http://host:fallbackPort/path...
              requestUrl.protocol = 'http:';
              requestUrl.port = fallbackPort.toString();
              
              const fallbackUrl = requestUrl.toString();
              
              logger.warn('HTTPS connection failed, falling back to HTTP', {
                operation: 'grpcFallback',
                module: 'grpc-client-factory',
                originalUrl: urlStr,
                fallbackUrl: fallbackUrl,
                hostname: actualHostname,
                host: host,
                port: port,
                fallbackPort: fallbackPort
              });
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fallbackResponse = await (baseFetch as any)(fallbackUrl, init);
              console.log('Fallback response status:', fallbackResponse.status);
              console.log('Fallback response headers:', Object.fromEntries(fallbackResponse.headers.entries()));

              // Log fallback response body for debugging
              const clonedFallbackResponse = fallbackResponse.clone();
              try {
                const bodyText = await clonedFallbackResponse.text();
                console.log('Fallback response body:', bodyText.substring(0, 500)); // Log first 500 chars
              } catch (bodyError) {
                console.log('Could not read fallback response body:', bodyError);
              }

              return fallbackResponse;
            }
          } catch (fallbackError) {
            // If fallback fails or URL parsing fails, we just ignore and throw original error below
            if (fallbackError instanceof Error && 'message' in fallbackError && fallbackError.message !== 'fetch failed') {
              // Only log if it's not just another connection failure (reduce noise)
              logger.warn('Fallback attempt error', {
                operation: 'grpcFallback',
                module: 'grpc-client-factory',
                hostname: actualHostname,
                host: host,
                fallbackPort: fallbackPort,
                error: fallbackError.message,
                errorName: fallbackError.name,
                failedUrl: urlStr,
                baseUrl: baseUrl
              });
            }
          }
        }
      }
      throw error;
    }
  };

  // Detect client-side environment (React Native or Web Browser)
  // Only use standard fetch in Node.js server environment
  const isNodeJs = typeof process !== 'undefined' &&
    typeof process.versions !== 'undefined' &&
    typeof process.versions.node !== 'undefined';

  // Use gRPC-Web transport with binary format
  // In React Native or Web browsers, use custom fetch wrapper to handle binary responses
  // In Node.js, use the retryingFetch with fallback logic
  const transport = createGrpcWebTransport({
    baseUrl,
    useBinaryFormat: true,
    interceptors: [errorNormalizer],
    // Use custom fetch wrapper for all client-side environments (RN + Web)
    fetch: !isNodeJs ? createGrpcWebFetch() : retryingFetch
  });

  // Apply service name mapping if applicable
  let finalService = service;
  if (service.typeName in SERVICE_TYPE_NAME_MAPPING) {
    // Create a shallow copy with the modified typeName to match Envoy rewriting rules
    finalService = { 
      ...service, 
      typeName: SERVICE_TYPE_NAME_MAPPING[service.typeName] 
    } as T;
  }

  return createPromiseClient(finalService, transport);
}
