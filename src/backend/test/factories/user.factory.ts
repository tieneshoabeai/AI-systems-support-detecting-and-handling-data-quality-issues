/** Factory user - seed co dinh, email @test.local, sdt 0900000000+ (T18) */
let seq = 0;
export interface TestUser { email: string; phone: string; role: 'admin' | 'analyst'; seed: number }
export function makeUser(seed = 42, overrides: Partial<TestUser> = {}): TestUser {
  seq += 1;
  const n = seed * 1000 + seq;
  return {
    email: overrides.email ?? `user${n}@test.local`,
    phone: overrides.phone ?? `090${String(1000000 + (n % 9000000))}`,
    role: overrides.role ?? 'analyst',
    seed,
  };
}
export function resetUserFactory(): void { seq = 0; }
