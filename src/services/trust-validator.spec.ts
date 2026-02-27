import { validateTrustAssignment, suggestTrustLevel } from './trust-validator.js';

describe('validateTrustAssignment', () => {
  it('accepts trust levels in valid range', () => {
    expect(validateTrustAssignment(0).valid).toBe(true);
    expect(validateTrustAssignment(0.5).valid).toBe(true);
    expect(validateTrustAssignment(1.0).valid).toBe(true);
  });

  it('rejects trust levels below 0', () => {
    const result = validateTrustAssignment(-0.1);
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('-0.1');
  });

  it('rejects trust levels above 1', () => {
    const result = validateTrustAssignment(1.5);
    expect(result.valid).toBe(false);
    expect(result.warning).toContain('1.5');
  });

  it('warns for trust < 0.25', () => {
    const result = validateTrustAssignment(0.1);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain('very restrictive');
  });

  it('warns for trust 0', () => {
    const result = validateTrustAssignment(0);
    expect(result.valid).toBe(true);
    expect(result.warning).toContain('very restrictive');
  });

  it('does not warn for trust >= 0.25', () => {
    expect(validateTrustAssignment(0.25).warning).toBeUndefined();
    expect(validateTrustAssignment(0.5).warning).toBeUndefined();
    expect(validateTrustAssignment(1.0).warning).toBeUndefined();
  });
});

describe('suggestTrustLevel', () => {
  describe('tag overrides', () => {
    it('returns 0.1 for private tag', () => {
      expect(suggestTrustLevel('note', ['private'])).toBe(0.1);
    });

    it('returns 0.1 for secret tag', () => {
      expect(suggestTrustLevel('note', ['Secret'])).toBe(0.1);
    });

    it('returns 1.0 for public tag', () => {
      expect(suggestTrustLevel('journal', ['public'])).toBe(1.0);
    });

    it('tag override takes priority over content type', () => {
      // journal normally suggests 0.75, but 'private' overrides to 0.1
      expect(suggestTrustLevel('journal', ['private'])).toBe(0.1);
    });
  });

  describe('content type suggestions', () => {
    it('suggests 0.75 for personal types', () => {
      expect(suggestTrustLevel('journal')).toBe(0.75);
      expect(suggestTrustLevel('memory')).toBe(0.75);
      expect(suggestTrustLevel('event')).toBe(0.75);
    });

    it('suggests 0.5 for system types', () => {
      expect(suggestTrustLevel('system')).toBe(0.5);
      expect(suggestTrustLevel('audit')).toBe(0.5);
      expect(suggestTrustLevel('action')).toBe(0.5);
      expect(suggestTrustLevel('history')).toBe(0.5);
    });

    it('suggests 0.5 for business types', () => {
      expect(suggestTrustLevel('invoice')).toBe(0.5);
      expect(suggestTrustLevel('contract')).toBe(0.5);
    });

    it('suggests 0.5 for communication types', () => {
      expect(suggestTrustLevel('email')).toBe(0.5);
      expect(suggestTrustLevel('conversation')).toBe(0.5);
      expect(suggestTrustLevel('meeting')).toBe(0.5);
    });

    it('suggests 0.75 for ghost type', () => {
      expect(suggestTrustLevel('ghost')).toBe(0.75);
    });

    it('suggests 0.25 for general/creative types', () => {
      expect(suggestTrustLevel('note')).toBe(0.25);
      expect(suggestTrustLevel('code')).toBe(0.25);
      expect(suggestTrustLevel('article')).toBe(0.25);
      expect(suggestTrustLevel('recipe')).toBe(0.25);
      expect(suggestTrustLevel('bookmark')).toBe(0.25);
    });
  });

  describe('edge cases', () => {
    it('handles empty tags array', () => {
      expect(suggestTrustLevel('note', [])).toBe(0.25);
    });

    it('handles undefined tags', () => {
      expect(suggestTrustLevel('note')).toBe(0.25);
    });
  });
});
