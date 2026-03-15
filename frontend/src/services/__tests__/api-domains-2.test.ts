import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  eventsApi,
  contendersApi,
  siteConfigApi,
  statisticsApi,
} from '../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Helper to create a mock Response
function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.setItem('accessToken', 'test-token-123');
  global.fetch = vi.fn();
});

afterEach(() => {
  sessionStorage.clear();
});

// ---------------------------------------------------------------------------
// eventsApi
// ---------------------------------------------------------------------------
describe('eventsApi', () => {
  it('getAll calls /events with no query params when no filters', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse([]));

    await eventsApi.getAll();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/events`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token-123' }) }),
    );
  });

  it('getAll appends status, seasonId, and eventType query params', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse([]));

    await eventsApi.getAll({ status: 'upcoming', seasonId: 's1', eventType: 'ppv' });

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('eventType=ppv');
    expect(calledUrl).toContain('status=upcoming');
    expect(calledUrl).toContain('seasonId=s1');
  });

  it('getById calls /events/:id', async () => {
    const event = { eventId: 'e1', name: 'WrestleMania' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(event));

    const result = await eventsApi.getById('e1');

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/events/e1`,
      expect.any(Object),
    );
    expect(result).toEqual(event);
  });

  it('create sends POST with event body', async () => {
    const input = { name: 'Royal Rumble', eventType: 'ppv', date: '2024-01-28' };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse({ eventId: 'e2', ...input }));

    // @ts-expect-error partial input for test
    await eventsApi.create(input);

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(input);
  });

  it('update sends PUT to /events/:id and delete sends DELETE', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockResponse({ eventId: 'e1' }))
      .mockResolvedValueOnce(mockResponse(undefined, 204));

    // @ts-expect-error partial input for test
    await eventsApi.update('e1', { name: 'Updated' });
    await eventsApi.delete('e1');

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe('PUT');
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0]).toBe(`${API_BASE}/events/e1`);
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// contendersApi
// ---------------------------------------------------------------------------
describe('contendersApi', () => {
  it('getForChampionship calls /championships/:id/contenders', async () => {
    const data = { championshipId: 'c1', contenders: [] };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(data));

    const result = await contendersApi.getForChampionship('c1');

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/championships/c1/contenders`,
      expect.any(Object),
    );
    expect(result).toEqual(data);
  });

  it('recalculate sends POST to /admin/contenders/recalculate with optional championshipId', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockResponse({ message: 'ok', summary: {} }))
      .mockResolvedValueOnce(mockResponse({ message: 'ok', summary: {} }));

    // Without championshipId
    await contendersApi.recalculate();
    let body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({});

    // With championshipId
    await contendersApi.recalculate('c1');
    body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
    expect(body).toEqual({ championshipId: 'c1' });
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][1].method).toBe('POST');
  });
});

// ---------------------------------------------------------------------------
// siteConfigApi
// ---------------------------------------------------------------------------
describe('siteConfigApi', () => {
  it('getFeatures calls GET /site-config', async () => {
    const data = { features: { contenders: true, statistics: true } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(data));

    const result = await siteConfigApi.getFeatures();

    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/site-config`,
      expect.any(Object),
    );
    expect(result.features.contenders).toBe(true);
  });

  it('updateFeatures sends PUT to /admin/site-config with features payload', async () => {
    const updated = { features: { contenders: false, statistics: true } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse(updated));

    await siteConfigApi.updateFeatures({ contenders: false });

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${API_BASE}/admin/site-config`);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ features: { contenders: false } });
  });
});

// ---------------------------------------------------------------------------
// statisticsApi
// ---------------------------------------------------------------------------
describe('statisticsApi', () => {
  it('getWrestlerStats includes section=wrestler-stats and optional wrestlerId', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockResponse({ wrestlers: [], statistics: [] }))
      .mockResolvedValueOnce(mockResponse({ wrestlers: [], statistics: [] }));

    // Without wrestlerId
    await statisticsApi.getWrestlerStats();
    let url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('section=wrestler-stats');
    expect(url).not.toContain('wrestlerId');

    // With wrestlerId
    await statisticsApi.getWrestlerStats('p1');
    url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(url).toContain('section=wrestler-stats');
    expect(url).toContain('wrestlerId=p1');
  });

  it('getHeadToHead includes section=head-to-head with both wrestler IDs', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ wrestlers: [], headToHead: null, wrestler1Stats: {}, wrestler2Stats: {} }),
    );

    await statisticsApi.getHeadToHead('p1', 'p2');

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('section=head-to-head');
    expect(url).toContain('wrestler1Id=p1');
    expect(url).toContain('wrestler2Id=p2');
  });

  it('getLeaderboards includes section=leaderboards', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ wrestlers: [], leaderboards: {} }),
    );

    await statisticsApi.getLeaderboards();

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('section=leaderboards');
  });

  it('getRecords includes section=records', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse({ records: {}, activeThreats: [] }),
    );

    await statisticsApi.getRecords();

    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('section=records');
  });

  it('getAchievements includes section=achievements and optional wrestlerId', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockResponse({ wrestlers: [], allAchievements: [] }))
      .mockResolvedValueOnce(mockResponse({ wrestlers: [], allAchievements: [], achievements: [] }));

    await statisticsApi.getAchievements();
    let url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain('section=achievements');
    expect(url).not.toContain('wrestlerId');

    await statisticsApi.getAchievements('p1');
    url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1][0] as string;
    expect(url).toContain('section=achievements');
    expect(url).toContain('wrestlerId=p1');
  });
});
