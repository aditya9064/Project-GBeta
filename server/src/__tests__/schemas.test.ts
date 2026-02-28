import { describe, it, expect } from 'vitest';
import { gmailSendSchema, agentGenerateSchema, visionStartSchema } from '../middleware/schemas.js';

describe('Validation Schemas', () => {
  describe('gmailSendSchema', () => {
    it('accepts valid email data', () => {
      const result = gmailSendSchema.safeParse({ to: 'test@example.com', subject: 'Hello' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = gmailSendSchema.safeParse({ to: 'not-an-email', subject: 'Hello' });
      expect(result.success).toBe(false);
    });

    it('rejects missing subject', () => {
      const result = gmailSendSchema.safeParse({ to: 'test@example.com' });
      expect(result.success).toBe(false);
    });
  });

  describe('agentGenerateSchema', () => {
    it('accepts valid prompt', () => {
      const result = agentGenerateSchema.safeParse({ prompt: 'Create an email agent' });
      expect(result.success).toBe(true);
    });

    it('rejects empty prompt', () => {
      const result = agentGenerateSchema.safeParse({ prompt: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('visionStartSchema', () => {
    it('accepts task with url', () => {
      const result = visionStartSchema.safeParse({ task: 'Find prices', url: 'https://example.com' });
      expect(result.success).toBe(true);
    });

    it('accepts task without url', () => {
      const result = visionStartSchema.safeParse({ task: 'Find prices' });
      expect(result.success).toBe(true);
    });

    it('rejects missing task', () => {
      const result = visionStartSchema.safeParse({ url: 'https://example.com' });
      expect(result.success).toBe(false);
    });
  });
});
