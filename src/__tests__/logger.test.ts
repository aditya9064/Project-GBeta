import { describe, it, expect } from 'vitest';

describe('logger', () => {
  it('should export log object with all methods', async () => {
    const { log } = await import('../utils/logger');
    expect(log.debug).toBeTypeOf('function');
    expect(log.info).toBeTypeOf('function');
    expect(log.warn).toBeTypeOf('function');
    expect(log.error).toBeTypeOf('function');
  });
});
