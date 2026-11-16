/** Shared ObjectId helper — Application/Domain được phép dùng, không cần mongoose. */
export function isObjectIdHex(id: string): boolean {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}
