/**
 * B2.11 — Test unit cho `LocalInferenceAdapter`, `SystemResourceGuardAdapter`
 * và `OutboxRelayService`.
 *
 * Nhóm này bảo vệ **tính sống của hệ thống**:
 *   - `LocalInferenceAdapter` — gọi engine AI (vLLM/Ollama), timeout, RAM guard.
 *   - `SystemResourceGuardAdapter` — đọc `/proc/meminfo` + RSS engine để chặn
 *     job AI khi RAM không đủ (tránh OOM làm sập API trên VPS 15 GB).
 *   - `OutboxRelayService` — đẩy event từ outbox ra bus, đánh dấu
 *     published/failed (đảm bảo event không bị mất và không publish trùng).
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalInferenceAdapter } from '../src/modules/analysis/infrastructure/ai/local-inference.adapter';
import { SystemResourceGuardAdapter } from '../src/modules/analysis/infrastructure/ai/system-resource-guard.adapter';
import { OutboxRelayService } from '../src/shared/infrastructure/outbox/outbox-relay.service';
import { OutboxService } from '../src/shared/infrastructure/outbox/outbox.service';
import { EVENT_PUBLISHER_PORT } from '../src/shared/application/ports/event-publisher.port';

// ───────────────────────────────────────────────────────────────────────────
// LocalInferenceAdapter
// ───────────────────────────────────────────────────────────────────────────

describe('B2.11 — LocalInferenceAdapter', () => {
  let config: { get: jest.Mock };
  let guard: { blockReason: jest.Mock };
  let fetchMock: jest.Mock;

  const originalFetch = global.fetch;

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_ENGINE') return 'ollama';
        if (key === 'AI_INFERENCE_BASE_URL') return 'http://ai.local:11434/';
        return undefined;
      }),
    };
    guard = { blockReason: jest.fn(() => null) };
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  afterEach(() => {
    (global as unknown as { fetch: unknown }).fetch = originalFetch;
  });

  const makeAdapter = (): LocalInferenceAdapter =>
    new LocalInferenceAdapter(config as unknown as ConfigService, guard as never);

  it('AI_ENGINE=vllm ⇒ engine = vllm', () => {
    config.get.mockImplementation((k: string) =>
      k === 'AI_ENGINE' ? 'vLLM' : k === 'AI_INFERENCE_BASE_URL' ? 'http://x' : undefined,
    );
    expect(makeAdapter().engine).toBe('vllm');
  });

  it('AI_ENGINE không xác định ⇒ mặc định ollama', () => {
    config.get.mockImplementation((k: string) =>
      k === 'AI_ENGINE' ? 'unknown-engine' : undefined,
    );
    expect(makeAdapter().engine).toBe('ollama');
  });

  it('thiếu baseUrl ⇒ ném lỗi cấu hình', async () => {
    config.get.mockImplementation(() => undefined);
    const adapter = makeAdapter();
    await expect(
      adapter.complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/AI_INFERENCE_BASE_URL/);
  });

  it('RAM Guard chặn ⇒ ném lỗi, KHÔNG gọi engine', async () => {
    guard.blockReason.mockReturnValue('RAM khong du');
    const adapter = makeAdapter();
    await expect(
      adapter.complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/RAM Guard/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ollama: trả về text từ response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ response: '{"a":1}' }),
    });
    const adapter = makeAdapter();
    const res = await adapter.complete({ prompt: 'p', timeoutMs: 5000, modelId: 'm1' });

    expect(res.text).toBe('{"a":1}');
    expect(res.modelId).toBe('m1');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ai.local:11434/api/generate');
    expect(JSON.parse(init.body).model).toBe('m1');
  });

  it('ollama: HTTP lỗi ⇒ ném lỗi kèm status', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'server exploded',
    });
    const adapter = makeAdapter();
    await expect(
      adapter.complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/Ollama HTTP 500/);
  });

  it('ollama: response rỗng ⇒ ném lỗi', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const adapter = makeAdapter();
    await expect(
      adapter.complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/Ollama tra ve rong/);
  });

  it('vllm: trả về content từ choices', async () => {
    config.get.mockImplementation((k: string) => {
      if (k === 'AI_ENGINE') return 'vllm';
      if (k === 'AI_INFERENCE_BASE_URL') return 'http://ai.local:8000';
      if (k === 'AI_INFERENCE_API_KEY') return 'sk-test';
      return undefined;
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"b":2}' } }] }),
    });
    const adapter = makeAdapter();
    const res = await adapter.complete({ prompt: 'p', timeoutMs: 5000, modelId: null });

    expect(res.text).toBe('{"b":2}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://ai.local:8000/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });

  it('vllm: không có API key ⇒ không gắn Authorization', async () => {
    config.get.mockImplementation((k: string) => {
      if (k === 'AI_ENGINE') return 'vllm';
      if (k === 'AI_INFERENCE_BASE_URL') return 'http://ai.local:8000';
      return undefined;
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{}' } }] }),
    });
    await makeAdapter().complete({ prompt: 'p', timeoutMs: 1000, modelId: null });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('vllm: HTTP lỗi ⇒ ném lỗi', async () => {
    config.get.mockImplementation((k: string) => {
      if (k === 'AI_ENGINE') return 'vllm';
      if (k === 'AI_INFERENCE_BASE_URL') return 'http://ai.local:8000';
      return undefined;
    });
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => 'unavailable' });
    await expect(
      makeAdapter().complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/vLLM HTTP 503/);
  });

  it('vllm: content rỗng ⇒ ném lỗi', async () => {
    config.get.mockImplementation((k: string) => {
      if (k === 'AI_ENGINE') return 'vllm';
      if (k === 'AI_INFERENCE_BASE_URL') return 'http://ai.local:8000';
      return undefined;
    });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    await expect(
      makeAdapter().complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/vLLM tra ve rong/);
  });

  it('AbortError ⇒ chuyển thành lỗi timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);
    const adapter = makeAdapter();
    await expect(
      adapter.complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow(/timeout sau 1000ms/);
  });

  it('lỗi thường được giữ nguyên', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(
      makeAdapter().complete({ prompt: 'p', timeoutMs: 1000, modelId: null }),
    ).rejects.toThrow('network down');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SystemResourceGuardAdapter
// ───────────────────────────────────────────────────────────────────────────

describe('B2.11 — SystemResourceGuardAdapter', () => {
  const makeGuard = (over: Record<string, unknown> = {}): SystemResourceGuardAdapter => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'AI_RAM_GUARD_PERCENT') return 85;
        if (key === 'AI_MIN_RAM_GB') return 12;
        return undefined;
      }),
    };
    const adapter = new SystemResourceGuardAdapter(config as unknown as ConfigService);
    // Ghi đè private để test deterministically.
    Object.assign(adapter, over);
    return adapter;
  };

  it('đọc được /proc/meminfo trên Linux ⇒ totalBytes > 0', () => {
    const status = makeGuard().check();
    expect(status.totalBytes).toBeGreaterThan(0);
    expect(status.availableBytes).toBeGreaterThanOrEqual(0);
  });

  it('meminfo không đọc được ⇒ totalBytes = 0, không chặn', () => {
    const adapter = makeGuard();
    (adapter as unknown as { readMemInfo: () => null }).readMemInfo = () => null;
    (adapter as unknown as { readEngineRssBytes: () => number }).readEngineRssBytes = () => 0;

    const status = adapter.check();
    expect(status.totalBytes).toBe(0);
    expect(status.blocked).toBe(false);
  });

  it('RAM khả dụng dưới ngưỡng ⇒ blocked = true', () => {
    const adapter = makeGuard();
    (adapter as unknown as { readMemInfo: () => { totalBytes: number; availableBytes: number } }).readMemInfo =
      () => ({ totalBytes: 16 * 1024 ** 3, availableBytes: 2 * 1024 ** 3 });
    (adapter as unknown as { readEngineRssBytes: () => number }).readEngineRssBytes = () => 0;

    const status = adapter.check();
    expect(status.blocked).toBe(true);
    expect(status.reason).toContain('RAM kha dung');
  });

  it('RAM đã dùng vượt % ngưỡng ⇒ blocked = true', () => {
    const adapter = makeGuard();
    (adapter as unknown as { readMemInfo: () => { totalBytes: number; availableBytes: number } }).readMemInfo =
      () => ({ totalBytes: 16 * 1024 ** 3, availableBytes: 1 * 1024 ** 3 });
    (adapter as unknown as { readEngineRssBytes: () => number }).readEngineRssBytes = () => 0;

    const status = adapter.check();
    expect(status.blocked).toBe(true);
    expect(status.reason).toContain('RAM he thong da dung');
  });

  it('RSS engine vượt ngưỡng ⇒ blocked = true', () => {
    const adapter = makeGuard();
    (adapter as unknown as { readMemInfo: () => { totalBytes: number; availableBytes: number } }).readMemInfo =
      () => ({ totalBytes: 16 * 1024 ** 3, availableBytes: 15 * 1024 ** 3 });
    (adapter as unknown as { readEngineRssBytes: () => number }).readEngineRssBytes = () =>
      15 * 1024 ** 3;

    const status = adapter.check();
    expect(status.blocked).toBe(true);
    expect(status.reason).toContain('RSS engine');
  });

  it('RAM dồi dào ⇒ blocked = false, blockReason = null', () => {
    const adapter = makeGuard();
    (adapter as unknown as { readMemInfo: () => { totalBytes: number; availableBytes: number } }).readMemInfo =
      () => ({ totalBytes: 64 * 1024 ** 3, availableBytes: 32 * 1024 ** 3 });
    (adapter as unknown as { readEngineRssBytes: () => number }).readEngineRssBytes = () => 0;

    expect(adapter.canAcceptAiJob()).toBe(true);
    expect(adapter.blockReason()).toBeNull();
  });

  it('cache 5s ⇒ gọi check() lần 2 không đọc lại meminfo', () => {
    const adapter = makeGuard();
    const readMemInfo = jest.fn(() => ({
      totalBytes: 64 * 1024 ** 3,
      availableBytes: 32 * 1024 ** 3,
    }));
    (adapter as unknown as { readMemInfo: () => unknown }).readMemInfo = readMemInfo;
    (adapter as unknown as { readEngineRssBytes: () => number }).readEngineRssBytes = () => 0;

    adapter.check();
    adapter.check();
    expect(readMemInfo).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// OutboxRelayService
// ───────────────────────────────────────────────────────────────────────────

describe('B2.11 — OutboxRelayService', () => {
  let outbox: {
    reclaimStuckPublishing: jest.Mock;
    claimForPublish: jest.Mock;
    markAsPublished: jest.Mock;
    markAsFailed: jest.Mock;
  };
  let publisher: { publish: jest.Mock; mode: string };
  let config: { get: jest.Mock };
  let relay: OutboxRelayService;

  const doc = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    _id: { toString: () => 'evt-1' },
    event_type: 'DATASET_INGESTED',
    aggregate_type: 'Dataset',
    aggregate_id: 'ds-1',
    payload: { a: 1 },
    workspace_id: 'ws-1',
    project_id: 'p-1',
    actor_id: 'u-1',
    ...over,
  });

  beforeEach(async () => {
    outbox = {
      reclaimStuckPublishing: jest.fn(async () => 0),
      claimForPublish: jest.fn(async () => []),
      markAsPublished: jest.fn(async () => undefined),
      markAsFailed: jest.fn(async () => undefined),
    };
    publisher = { publish: jest.fn(async () => undefined), mode: 'in-process' };
    config = { get: jest.fn(() => undefined) };

    const module = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        { provide: OutboxService, useValue: outbox },
        { provide: ConfigService, useValue: config },
        { provide: EVENT_PUBLISHER_PORT, useValue: publisher },
      ],
    }).compile();

    relay = module.get(OutboxRelayService);
  });

  it('không có event ⇒ trả 0', async () => {
    await expect(relay.tick()).resolves.toBe(0);
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('publish event và đánh dấu published', async () => {
    outbox.claimForPublish.mockResolvedValue([doc()]);
    await expect(relay.tick()).resolves.toBe(1);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        eventType: 'DATASET_INGESTED',
        aggregateType: 'Dataset',
        aggregateId: 'ds-1',
        payload: { a: 1 },
        workspaceId: 'ws-1',
        projectId: 'p-1',
        actorId: 'u-1',
      }),
    );
    expect(outbox.markAsPublished).toHaveBeenCalledWith('evt-1');
    expect(outbox.markAsFailed).not.toHaveBeenCalled();
  });

  it('publish lỗi ⇒ đánh dấu failed, không đánh dấu published', async () => {
    outbox.claimForPublish.mockResolvedValue([doc()]);
    publisher.publish.mockRejectedValue(new Error('bus unavailable'));

    await expect(relay.tick()).resolves.toBe(0);
    expect(outbox.markAsFailed).toHaveBeenCalledWith('evt-1', 'bus unavailable');
    expect(outbox.markAsPublished).not.toHaveBeenCalled();
  });

  it('lỗi không phải Error ⇒ vẫn đánh dấu failed', async () => {
    outbox.claimForPublish.mockResolvedValue([doc()]);
    publisher.publish.mockRejectedValue('string error');
    await relay.tick();
    expect(outbox.markAsFailed).toHaveBeenCalledWith('evt-1', 'string error');
  });

  it('một event lỗi không chặn các event sau', async () => {
    outbox.claimForPublish.mockResolvedValue([
      doc({ _id: { toString: () => 'evt-1' } }),
      doc({ _id: { toString: () => 'evt-2' } }),
    ]);
    publisher.publish
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValueOnce(undefined);

    await expect(relay.tick()).resolves.toBe(1);
    expect(outbox.markAsFailed).toHaveBeenCalledWith('evt-1', 'fail 1');
    expect(outbox.markAsPublished).toHaveBeenCalledWith('evt-2');
  });

  it('reclaimStuckPublishing được gọi trước khi claim', async () => {
    await relay.tick();
    expect(outbox.reclaimStuckPublishing).toHaveBeenCalled();
    expect(outbox.claimForPublish).toHaveBeenCalledWith(50);
  });

  it('busy ⇒ tick tiếp theo trả 0 ngay', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    outbox.claimForPublish.mockImplementation(async () => {
      await gate;
      return [];
    });

    const first = relay.tick();
    await expect(relay.tick()).resolves.toBe(0);
    release();
    await first;
  });

  it('không có publisher ⇒ vẫn đánh dấu published (outbox drain)', async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        { provide: OutboxService, useValue: outbox },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    const bare = module.get(OutboxRelayService);
    outbox.claimForPublish.mockResolvedValue([doc()]);

    await expect(bare.tick()).resolves.toBe(1);
    expect(outbox.markAsPublished).toHaveBeenCalledWith('evt-1');
  });

  it('WORKER_MODE=api ⇒ onModuleInit không bật relay', () => {
    config.get.mockImplementation((k: string) => (k === 'WORKER_MODE' ? 'api' : undefined));
    relay.onModuleInit();
    expect(config.get).toHaveBeenCalledWith('WORKER_MODE');
  });

  it('OUTBOX_RELAY_ENABLED=false ⇒ onModuleInit không bật relay', () => {
    config.get.mockImplementation((k: string) =>
      k === 'OUTBOX_RELAY_ENABLED' ? 'false' : undefined,
    );
    relay.onModuleInit();
    expect(config.get).toHaveBeenCalledWith('OUTBOX_RELAY_ENABLED');
  });
});
