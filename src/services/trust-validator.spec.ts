import { validateTrustAssignment, suggestTrustLevel } from './trust-validator.js';

describe('validateTrustAssignment', () => {
  it('accepts trust levels in valid range', () => {
    expect(validateTrustAssignment(1).valid).toBe(true);
    expect(validateTrustAssignment(3).valid).toBe(true);
    expect(validateTrustAssignment(5).valid).toBe(true);
  });

  it('rejects trust levels below 1', () => {
    const result = validateTrustAssignment(0);
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('0');
  });

  it('rejects trust levels above 5', () => {
    const result = validateTrustAssignment(6);
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('6');
  });

  it('rejects non-integer trust levels', () => {
    const result = validateTrustAssignment(2.5);
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('2.5');
  });

  it('warns for trust >= 4 (RESTRICTED)', () => {
    const result = validateTrustAssignment(4);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain('very restrictive');
  });

  it('warns for trust 5 (SECRET)', () => {
    const result = validateTrustAssignment(5);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain('very restrictive');
  });

  it('does not warn for trust <= 3', () => {
    expect(validateTrustAssignment(1).warning).toBeUndefined();
    expect(validateTrustAssignment(2).warning).toBeUndefined();
    expect(validateTrustAssignment(3).warning).toBeUndefined();
  });
});

describe('suggestTrustLevel', () => {
  describe('tag overrides', () => {
    it('returns 5 (SECRET) for private tag', () => {
      expect(suggestTrustLevel('note', ['private'])).toBe(5);
    });

    it('returns 5 (SECRET) for secret tag', () => {
      expect(suggestTrustLevel('note', ['Secret'])).toBe(5);
    });

    it('returns 1 (PUBLIC) for public tag', () => {
      expect(suggestTrustLevel('journal', ['public'])).toBe(1);
    });

    it('tag override takes priority over content type', () => {
      // journal normally suggests 4, but 'private' overrides to 5
      expect(suggestTrustLevel('journal', ['private'])).toBe(5);
    });
  });

  describe('content type suggestions', () => {
    it('suggests 4 (RESTRICTED) for personal types', () => {
      expect(suggestTrustLevel('journal')).toBe(4);
      expect(suggestTrustLevel('memory')).toBe(4);
      expect(suggestTrustLevel('event')).toBe(4);
    });

    it('suggests 3 (CONFIDENTIAL) for system types', () => {
      expect(suggestTrustLevel('system')).toBe(3);
      expect(suggestTrustLevel('audit')).toBe(3);
      expect(suggestTrustLevel('action')).toBe(3);
      expect(suggestTrustLevel('history')).toBe(3);
    });

    it('suggests 3 (CONFIDENTIAL) for business types', () => {
      expect(suggestTrustLevel('invoice')).toBe(3);
      expect(suggestTrustLevel('contract')).toBe(3);
    });

    it('suggests 3 (CONFIDENTIAL) for communication types', () => {
      expect(suggestTrustLevel('email')).toBe(3);
      expect(suggestTrustLevel('conversation')).toBe(3);
      expect(suggestTrustLevel('meeting')).toBe(3);
    });

    it('suggests 4 (RESTRICTED) for ghost type', () => {
      expect(suggestTrustLevel('ghost')).toBe(4);
    });

    it('suggests 2 (INTERNAL) for general/creative types', () => {
      expect(suggestTrustLevel('note')).toBe(2);
      expect(suggestTrustLevel('code')).toBe(2);
      expect(suggestTrustLevel('article')).toBe(2);
      expect(suggestTrustLevel('recipe')).toBe(2);
      expect(suggestTrustLevel('bookmark')).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty tags array', () => {
      expect(suggestTrustLevel('note', [])).toBe(2);
    });

    it('handles undefined tags', () => {
      expect(suggestTrustLevel('note')).toBe(2);
    });
  });
});
