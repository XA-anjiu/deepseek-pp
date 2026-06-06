import { buildMcpRequestHeaders } from '../store';
import type {
  McpJsonRpcNotification,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpProtocolTransport,
  McpServerConfig,
} from '../types';
import {
  ensureMcpServerOriginPermission,
  fetchWithTimeout,
  getMcpEndpointUrl,
  readJsonRpcResponse,
} from './common';

export function createMcpHttpTransport(server: McpServerConfig): McpProtocolTransport {
  return {
    request(request, options) {
      return sendHttpMessage(server, request, options?.timeoutMs, options?.maxResponseBytes);
    },
    async notify(notification, options) {
      await sendHttpMessage(server, notification, options?.timeoutMs, options?.maxResponseBytes);
    },
  };
}

export function createMcpStreamableHttpTransport(server: McpServerConfig): McpProtocolTransport {
  return createMcpHttpTransport(server);
}

async function sendHttpMessage<TParams extends Record<string, unknown> | undefined, TResult>(
  server: McpServerConfig,
  message: McpJsonRpcRequest<TParams> | McpJsonRpcNotification,
  timeoutMs: number = server.timeouts.requestMs,
  maxResponseBytes: number = server.limits.maxResultBytes,
): Promise<McpJsonRpcResponse<TResult>> {
  await ensureMcpServerOriginPermission(server);
  const url = getMcpEndpointUrl(server);
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...buildMcpRequestHeaders(server),
    },
    body: JSON.stringify(message),
  }, timeoutMs);

  return readJsonRpcResponse<TResult>(
    response,
    'id' in message ? message as McpJsonRpcRequest<TParams> : undefined,
    { maxBytes: maxResponseBytes },
  );
}
