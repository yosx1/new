import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ db: {} }));

describe('usage meter', () => {
  it('uses the Pacific-time quota day', async () => {
    const { usageDay } = await import('../../src/lib/fs');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T05:00:00Z')); // 22 Oct 08:00 in Baghdad, still 21 Oct in California
    expect(usageDay()).toBe('2026-10-21');
    vi.setSystemTime(new Date('2026-10-22T08:00:00Z'));
    expect(usageDay()).toBe('2026-10-22');
    vi.useRealTimers();
  });
  it('free limits match the Spark plan', async () => {
    const { FREE_DAILY } = await import('../../src/lib/fs');
    expect(FREE_DAILY).toEqual({ reads: 50000, writes: 20000, deletes: 20000 });
  });
});
