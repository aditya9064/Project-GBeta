import { describe, it, expect } from 'vitest';

describe('ErrorBoundary', () => {
  it('should be importable', async () => {
    const mod = await import('../components/ErrorBoundary');
    expect(mod.ErrorBoundary).toBeDefined();
  });
});
