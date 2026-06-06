import { describe, expect, it } from 'vitest';
import { McpTransportError, readJsonRpcResponse } from '../core/mcp/transports/common';

describe('MCP transport response limits', () => {
  it('fails before parsing oversized JSON-RPC HTTP bodies', async () => {
    const body = JSON.stringify({ jsonrpc: '2.0', id: '1', result: { text: 'too large' } });
    const response = new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    await expect(readJsonRpcResponse(response, { jsonrpc: '2.0', id: '1', method: 'test' }, { maxBytes: 8 }))
      .rejects
      .toMatchObject({ code: 'mcp_response_too_large' } satisfies Partial<McpTransportError>);
  });
});

