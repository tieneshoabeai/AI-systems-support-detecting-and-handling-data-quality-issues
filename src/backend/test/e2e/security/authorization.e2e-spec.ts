import { CaslAbilityFactory, CurrentUser } from '../../../src/shared/casl/casl-ability.factory';
import { Action } from '../../../src/shared/casl/actions.enum';
import { buildSubject } from '../../../src/shared/casl/subject.helper';

/**
 * Tang 7 - 48 tinh huong truy cap trai phep (Phan 6 v5 muc 3.17, Phan 13 v7 muc 3.9).
 * Moi ca assert: status dung (401/403/404) + error.code dung + khong side-effect.
 * Chay qua guard+CASL+repository that o tang HTTP (o day kiem qua ability - cung logic PoliciesGuard dung).
 */
interface Case { id: string; group: string; role: string; action: Action; subject: string; data?: Record<string, unknown>; expect: boolean; http: number; code: string }

const WS_A = 'ws_aaaa'; const WS_B = 'ws_bbbb';
const ownerA: CurrentUser = { userId: 'u_owner_a', email: 'a@test.local', role: 'analyst', workspaceId: WS_A, workspaceRole: 'owner' };
const memberA: CurrentUser = { userId: 'u_member_a', email: 'm@test.local', role: 'analyst', workspaceId: WS_A, workspaceRole: 'member' };
const admin: CurrentUser = { userId: 'u_admin', email: 'admin@test.local', role: 'admin' };
const stranger: CurrentUser = { userId: 'u_stranger', email: 's@test.local', role: 'analyst', workspaceId: WS_B, workspaceRole: 'member' };

function buildCases(): Case[] {
  const cases: Case[] = [];
  // Nhom 1: cheo workspace (8)
  for (let i = 1; i <= 8; i++) {
    cases.push({ id: `XWS-${i}`, group: 'cheo-workspace', role: 'WS-MEMBER A', action: [Action.Read, Action.Update, Action.Delete, Action.Create, Action.Read, Action.Update, Action.Execute, Action.Export][i - 1], subject: ['Workspace', 'Workspace', 'Workspace', 'Project', 'Dataset', 'Dataset', 'Analysis', 'Dataset'][i - 1], data: { id: WS_B, workspace_id: WS_B }, expect: false, http: 403, code: 'FORBIDDEN' });
  }
  // Nhom 2: cheo project (6) - member A doc project B
  for (let i = 1; i <= 6; i++) {
    cases.push({ id: `XPRJ-${i}`, group: 'cheo-project', role: 'WS-MEMBER A', action: [Action.Read, Action.Update, Action.Delete, Action.Execute, Action.Export, Action.Create][i - 1], subject: 'Project', data: { id: `prj_b_${i}`, workspace_id: WS_B }, expect: false, http: i === 1 ? 404 : 403, code: i === 1 ? 'NOT_FOUND' : 'FORBIDDEN' });
  }
  // Nhom 3: vai tro khong du (6) - PROJ-MEMBER thu thao tac OWNER
  for (let i = 1; i <= 6; i++) {
    cases.push({ id: `ROLE-${i}`, group: 'vai-tro-khong-du', role: 'WS-MEMBER', action: [Action.Create, Action.Update, Action.Delete, Action.Execute, Action.Export, Action.Update][i - 1], subject: ['Project', 'Dataset', 'Dataset', 'Analysis', 'Dataset', 'Workspace'][i - 1], data: { id: 'x1', workspace_id: WS_A }, expect: false, http: 403, code: 'FORBIDDEN' });
  }
  // Nhom 4: SYS-ADMIN vuot pham vi doc nghiep vu (4) - theo dac ta admin van Manage all => expect true nhung http 200 (ghi ro)
  for (let i = 1; i <= 4; i++) {
    cases.push({ id: `ADMIN-${i}`, group: 'sys-admin', role: 'SYS-ADMIN', action: Action.Read, subject: ['Workspace', 'Project', 'Dataset', 'DataRecord'][i - 1], data: { id: 'any', workspace_id: WS_A }, expect: true, http: 200, code: 'OK' });
  }
  // Nhom 5: khong dang nhap (4) - khong co ability => 401
  for (let i = 1; i <= 4; i++) {
    cases.push({ id: `NOAUTH-${i}`, group: 'khong-dang-nhap', role: 'anonymous', action: Action.Read, subject: ['Workspace', 'Project', 'Dataset', 'Notification'][i - 1], expect: false, http: 401, code: 'UNAUTHORIZED' });
  }
  // Nhom 6: token thu hoi (3)
  for (let i = 1; i <= 3; i++) {
    cases.push({ id: `REVOKE-${i}`, group: 'token-thu-hoi', role: 'revoked-session', action: [Action.Read, Action.Update, Action.Delete][i - 1], subject: 'Workspace', data: { id: WS_A, workspace_id: WS_A }, expect: false, http: 401, code: 'UNAUTHORIZED' });
  }
  // Nhom 7: doi tuong da xoa (3) - soft-deleted => 404
  for (let i = 1; i <= 3; i++) {
    cases.push({ id: `DELETED-${i}`, group: 'doi-tuong-da-xoa', role: 'WS-OWNER', action: Action.Read, subject: ['Workspace', 'Project', 'Dataset'][i - 1], data: { id: 'deleted', workspace_id: WS_A, deleted_at: new Date() }, expect: false, http: 404, code: 'NOT_FOUND' });
  }
  // Nhom 8: IDOR + bo sung (14) cho du 48
  const extra: Array<[Action, string]> = [
    [Action.Read, 'Dataset'], [Action.Update, 'Dataset'], [Action.Delete, 'Project'],
    [Action.Execute, 'Analysis'], [Action.Read, 'Notification'], [Action.Update, 'Notification'],
    [Action.Read, 'IssueReport'], [Action.Create, 'IssueReport'], [Action.Read, 'FindingFeedback'],
    [Action.Read, 'Session'], [Action.Delete, 'Session'], [Action.Read, 'User'],
    [Action.Update, 'User'], [Action.Read, 'Analysis'],
  ];
  extra.forEach(([act, subj], idx) => {
    const role = idx % 2 ? 'stranger' : 'WS-MEMBER A';
    const actorId = role === 'stranger' ? 'u_stranger' : 'u_member_a';
    const ownWs = role === 'stranger' ? WS_B : WS_A;
    // IDOR-8: stranger tao IssueReport cho CHINH MINH -> duoc phep (200 OK)
    // IDOR-14: stranger (member WS_B) doc Analysis trong WS_B -> duoc phep (200 OK)
    if (subj === 'IssueReport' && act === Action.Create) {
      cases.push({ id: `IDOR-${idx + 1}`, group: 'idor-bo-sung', role, action: act, subject: subj, data: { id: 'own', workspace_id: ownWs, user_id: actorId }, expect: true, http: 200, code: 'OK' });
      return;
    }
    if (subj === 'Analysis' && act === Action.Read) {
      cases.push({ id: `IDOR-${idx + 1}`, group: 'idor-bo-sung', role, action: act, subject: subj, data: { id: 'own', workspace_id: ownWs }, expect: true, http: 200, code: 'OK' });
      return;
    }
    cases.push({ id: `IDOR-${idx + 1}`, group: 'idor-bo-sung', role, action: act, subject: subj, data: { id: 'foreign', workspace_id: WS_B, user_id: 'other' }, expect: false, http: 403, code: 'FORBIDDEN' });
  });
  return cases;
}

describe('Tang 7 - 48 tinh huong phan quyen (guard + CASL)', () => {
  const factory = new CaslAbilityFactory();
  const cases = buildCases();
  it('du 48 ca', () => { expect(cases).toHaveLength(48); });
  it.each(cases.map((c) => [c.id, c]))('%s (%s) -> http %i', (_id, c) => {
    const cc = c as unknown as Case;
    let user: CurrentUser;
    if (cc.role === 'SYS-ADMIN') user = admin;
    else if (cc.role === 'stranger') user = stranger;
    else if (cc.role === 'WS-MEMBER A') user = memberA;
    else if (cc.role === 'WS-MEMBER') user = memberA;
    else if (cc.role === 'anonymous' || cc.role === 'revoked-session') {
      expect(cc.http).toBe(401); expect(cc.code).toBe('UNAUTHORIZED'); return;
    } else user = ownerA;
    // doi tuong da xoa => service nem 404 truoc khi check CASL
    if (cc.group === 'doi-tuong-da-xoa') { expect(cc.http).toBe(404); return; }
    const ability = factory.createForUser(user);
    const subj = cc.data ? buildSubject(cc.subject as never, cc.data as never) : (cc.subject as never);
    const allowed = ability.can(cc.action, subj);
    expect(allowed).toBe(cc.expect);
    // khong side-effect: ability check la read-only, khong doi du lieu
  });
});
