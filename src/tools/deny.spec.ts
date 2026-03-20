/**
 * Tests for deny tool — secret_token passthrough.
 */

import { handleDeny } from './deny.js';

// ─── Mocks ──────────────────────────────────────────────────

jest.mock('../core-services.js', () => ({
  createCoreServices: jest.fn(),
}));

jest.mock('../utils/debug.js', () => ({
  createDebugLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
    time: jest.fn((_: string, fn: () => any) => fn()),
  })),
}));

jest.mock('../utils/error-handler.js', () => ({
  handleToolError: jest.fn(),
}));

import { createCoreServices } from '../core-services.js';
const mockCreateCoreServices = createCoreServices as jest.MockedFunction<any>;

// ─── Tests ───────────────────────────────────────────────────

describe('deny tool', () => {
  let mockDeny: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeny = jest.fn();

    mockCreateCoreServices.mockReturnValue({
      space: { deny: mockDeny },
    });
  });

  it('passes secret_token through to space.deny when provided', async () => {
    mockDeny.mockResolvedValue({ success: true });

    await handleDeny({ token: 'tok-1', secret_token: 'sec-abc' }, 'user-1');

    expect(mockDeny).toHaveBeenCalledWith({ token: 'tok-1', secret_token: 'sec-abc' });
  });

  it('works without secret_token (backward compatible)', async () => {
    mockDeny.mockResolvedValue({ success: true });

    await handleDeny({ token: 'tok-1' }, 'user-1');

    expect(mockDeny).toHaveBeenCalledWith({ token: 'tok-1', secret_token: undefined });
  });
});
