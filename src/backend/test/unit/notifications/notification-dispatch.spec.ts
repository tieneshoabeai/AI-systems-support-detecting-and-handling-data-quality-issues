/**
 * Phần 13 v18 mục 3.31 — NTT-01: `dispatchNotificationViaPorts`
 * (Phần 9 v7 mục 3.14, Phần 7 v16 mục 3.26 NT-5, NT-6).
 */
import {
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  dispatchNotificationViaPorts,
} from '../../../src/modules/notifications';

const USER = '111111111111111111111111';

function ports(opts: { enabled?: boolean | null; duplicate?: boolean; userFails?: boolean } = {}) {
  const repo = {
    createIfEventNotExists: jest.fn(async (doc: { type: string }) =>
      opts.duplicate ? null : { id: 'ntf1', type: doc.type },
    ),
  };
  const users = {
    findById: jest.fn(async () => {
      if (opts.userFails) throw new Error('db');
      return opts.enabled === null ? null : { notificationsEnabled: opts.enabled ?? true };
    }),
  };
  const realtime = { emitToUser: jest.fn() };
  return { repo, users, realtime };
}

describe('dispatchNotificationViaPorts (NTT-01)', () => {
  const input = {
    userId: USER,
    type: 'analysis_completed' as const,
    title: 'Phân tích dữ liệu đã xong',
    summary: 'ok',
    payload: { targetType: 'analysis_run', targetId: 'r1', actionUrl: null },
    sourceEventId: 'analysis_completed:r1',
  };

  it('tạo được → gọi repo đúng trường và phát notification.created', async () => {
    const p = ports();
    const res = await dispatchNotificationViaPorts(p.repo as never, p.users as never, p.realtime as never, input);
    expect(res).toMatchObject({ id: 'ntf1' });
    expect(p.repo.createIfEventNotExists).toHaveBeenCalledWith({
      userId: USER,
      type: 'analysis_completed',
      title: input.title,
      summary: 'ok',
      payload: input.payload,
      sourceEventId: 'analysis_completed:r1',
      isMandatory: false,
    });
    expect(p.realtime.emitToUser).toHaveBeenCalledWith(USER, 'notification.created', {
      notificationId: 'ntf1',
      notificationType: 'analysis_completed',
    });
  });

  it('tắt công tắc + loại không bắt buộc → không tạo', async () => {
    const p = ports({ enabled: false });
    expect(await dispatchNotificationViaPorts(p.repo as never, p.users as never, p.realtime as never, input)).toBeNull();
    expect(p.repo.createIfEventNotExists).not.toHaveBeenCalled();
  });

  it('tắt công tắc nhưng loại bắt buộc → vẫn tạo', async () => {
    const p = ports({ enabled: false });
    await dispatchNotificationViaPorts(p.repo as never, p.users as never, p.realtime as never, {
      ...input,
      type: 'security_alert',
    });
    expect(p.repo.createIfEventNotExists).toHaveBeenCalledWith(expect.objectContaining({ isMandatory: true }));
  });

  it('không đọc được người dùng → coi như chưa tắt (như issues)', async () => {
    const p = ports({ userFails: true });
    await dispatchNotificationViaPorts(p.repo as never, p.users as never, undefined, input);
    expect(p.repo.createIfEventNotExists).toHaveBeenCalled();
  });

  it('trùng sourceEventId (repo trả null) → không phát realtime', async () => {
    const p = ports({ duplicate: true });
    expect(await dispatchNotificationViaPorts(p.repo as never, p.users as never, p.realtime as never, input)).toBeNull();
    expect(p.realtime.emitToUser).not.toHaveBeenCalled();
  });

  it('cắt tiêu đề / summary quá dài theo giới hạn entity', async () => {
    const p = ports();
    await dispatchNotificationViaPorts(p.repo as never, p.users as never, undefined, {
      ...input,
      title: 't'.repeat(MAX_TITLE_LENGTH + 50),
      summary: 's'.repeat(MAX_SUMMARY_LENGTH + 50),
    });
    const doc = p.repo.createIfEventNotExists.mock.calls[0]?.[0] as unknown as { title: string; summary: string };
    expect(doc.title).toHaveLength(MAX_TITLE_LENGTH);
    expect(doc.summary).toHaveLength(MAX_SUMMARY_LENGTH);
  });

  it('realtime lỗi → vẫn trả thông báo đã tạo', async () => {
    const p = ports();
    p.realtime.emitToUser.mockImplementation(() => {
      throw new Error('socket');
    });
    await expect(
      dispatchNotificationViaPorts(p.repo as never, p.users as never, p.realtime as never, input),
    ).resolves.toMatchObject({ id: 'ntf1' });
  });
});
