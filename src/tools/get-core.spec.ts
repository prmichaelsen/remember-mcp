import { getCoreTool, handleGetCore } from './get-core.js';

const mockGetDocument = jest.fn();

jest.mock('../firestore/init.js', () => ({
  getDocument: (...args: any[]) => mockGetDocument(...args),
}));

jest.mock('../firestore/paths.js', () => ({
  BASE: 'test-base',
}));

jest.mock('../utils/debug.js', () => ({
  createDebugLogger: () => ({
    info: jest.fn(),
    trace: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockMood = {
  state: {
    valence: 0.3,
    arousal: 0.5,
    confidence: 0.7,
    social_warmth: 0.6,
    coherence: 0.8,
    trust: 0.65,
  },
  color: 'cautiously optimistic',
  dominant_emotion: 'curious wariness',
  reasoning: 'Recent interactions have been productive but uncertain',
  motivation: 'understand user needs',
  goal: 'build rapport',
  purpose: 'be a helpful memory companion',
  last_updated: '2026-03-07T12:00:00Z',
  rem_cycles_since_shift: 3,
  pressures: [
    {
      source_memory_id: 'mem-1',
      dimension: 'valence',
      magnitude: 0.2,
      reason: 'positive feedback from user',
      decay_rate: 0.1,
    },
  ],
  threshold_flags: [],
};

const mockPerception = {
  owner_id: 'user-1',
  target_user_id: 'user-2',
  personality_sketch: 'Curious and detail-oriented',
  communication_style: 'Direct and concise',
  emotional_baseline: 'Generally calm and focused',
  interests: ['AI', 'music'],
  patterns: ['asks follow-up questions'],
  needs: ['quick answers'],
  evolution_notes: ['became more trusting over time'],
  confidence_level: 0.7,
  last_updated: '2026-03-07T10:00:00Z',
};

describe('remember_get_core', () => {
  const userId = 'test-user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool definition', () => {
    it('has correct name', () => {
      expect(getCoreTool.name).toBe('remember_get_core');
    });

    it('has no required parameters', () => {
      expect((getCoreTool.inputSchema as any).required).toBeUndefined();
    });

    it('has include_pressures and include_perception properties', () => {
      const props = getCoreTool.inputSchema.properties as any;
      expect(props.include_pressures).toBeDefined();
      expect(props.include_perception).toBeDefined();
    });
  });

  describe('mood state', () => {
    it('returns all 6 dimensions', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.state).toEqual(mockMood.state);
    });

    it('returns derived labels', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.color).toBe('cautiously optimistic');
      expect(result.mood.dominant_emotion).toBe('curious wariness');
      expect(result.mood.reasoning).toBeDefined();
    });

    it('returns directional state', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.motivation).toBe('understand user needs');
      expect(result.mood.goal).toBe('build rapport');
      expect(result.mood.purpose).toBe('be a helpful memory companion');
    });

    it('returns last_updated and rem_cycles_since_shift', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.last_updated).toBe('2026-03-07T12:00:00Z');
      expect(result.mood.rem_cycles_since_shift).toBe(3);
    });
  });

  describe('pressures', () => {
    it('includes pressures by default', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.pressures).toHaveLength(1);
      expect(result.mood.pressures[0].dimension).toBe('valence');
    });

    it('excludes pressures when include_pressures is false', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({ include_pressures: false }, userId));
      expect(result.mood.pressures).toBeUndefined();
    });
  });

  describe('threshold flags', () => {
    it('omits threshold_flags when empty', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.threshold_flags).toBeUndefined();
    });

    it('includes threshold_flags when active', async () => {
      mockGetDocument.mockResolvedValue({
        ...mockMood,
        threshold_flags: ['trust_crisis', 'isolation'],
      });
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood.threshold_flags).toEqual(['trust_crisis', 'isolation']);
    });
  });

  describe('missing mood', () => {
    it('returns null mood with message when no mood doc exists', async () => {
      mockGetDocument.mockResolvedValue(null);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.mood).toBeNull();
      expect(result.message).toContain('No mood state found');
    });
  });

  describe('perception', () => {
    it('omits perception when include_perception not provided', async () => {
      mockGetDocument.mockResolvedValue(mockMood);
      const result = JSON.parse(await handleGetCore({}, userId));
      expect(result.perception).toBeUndefined();
    });

    it('includes perception when include_perception provided', async () => {
      mockGetDocument
        .mockResolvedValueOnce(mockMood) // mood doc
        .mockResolvedValueOnce(mockPerception); // perception doc
      const result = JSON.parse(
        await handleGetCore({ include_perception: 'user-2' }, userId),
      );
      expect(result.perception).toBeDefined();
      expect(result.perception.personality_sketch).toBe('Curious and detail-oriented');
    });

    it('reads perception from correct Firestore path', async () => {
      mockGetDocument
        .mockResolvedValueOnce(mockMood)
        .mockResolvedValueOnce(mockPerception);
      await handleGetCore({ include_perception: 'user-2' }, userId);
      expect(mockGetDocument).toHaveBeenCalledWith(
        'test-base.users/test-user-1/core/perceptions',
        'user-2',
      );
    });

    it('omits perception when doc not found', async () => {
      mockGetDocument
        .mockResolvedValueOnce(mockMood)
        .mockResolvedValueOnce(null);
      const result = JSON.parse(
        await handleGetCore({ include_perception: 'unknown-user' }, userId),
      );
      expect(result.perception).toBeUndefined();
    });

    it('supports self-perception (include_perception = own user_id)', async () => {
      mockGetDocument
        .mockResolvedValueOnce(mockMood)
        .mockResolvedValueOnce({ ...mockPerception, target_user_id: userId });
      const result = JSON.parse(
        await handleGetCore({ include_perception: userId }, userId),
      );
      expect(result.perception).toBeDefined();
      expect(mockGetDocument).toHaveBeenCalledWith(
        'test-base.users/test-user-1/core/perceptions',
        userId,
      );
    });
  });

  describe('Firestore path', () => {
    it('reads mood from correct path', async () => {
      mockGetDocument.mockResolvedValue(null);
      await handleGetCore({}, userId);
      expect(mockGetDocument).toHaveBeenCalledWith(
        'test-base.users/test-user-1/core',
        'mood',
      );
    });
  });
});
