import * as crypto from 'crypto';
import { Readable, Transform, TransformCallback } from 'stream';

export const MAGIC_HEADER = Buffer.from('DATAQUAL', 'utf8'); // 8 bytes
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;
export const TAG_LENGTH = 16;
export const PBKDF2_ITERATIONS = 100000;
export const KEY_LENGTH = 32; // 256 bits

/**
 * Tính mã băm SHA-256 từ chuỗi hoặc Buffer bộ nhớ
 */
export function computeSha256Buffer(data: Buffer | string): string {
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Tính mã băm SHA-256 theo luồng (Streaming) để không nạp tệp lớn vào RAM
 */
export function computeSha256Stream(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Dẫn xuất khóa 256-bit từ mật khẩu người dùng bằng thuật toán chuẩn PBKDF2
 */
export function deriveKeyPbkdf2(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Mã hóa dữ liệu dạng Buffer bằng AES-256-GCM
 * Cấu trúc nhị phân gói tin: [Magic 8B][Salt 16B][IV 12B][Encrypted Payload][AuthTag 16B]
 */
export function encryptAes256GcmBuffer(plainBuffer: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKeyPbkdf2(password, salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([MAGIC_HEADER, salt, iv, encrypted, authTag]);
}

/**
 * Giải mã dữ liệu dạng Buffer bằng AES-256-GCM
 * Tự động kiểm tra tính toàn vẹn qua Auth Tag; nếu mật khẩu sai hoặc dữ liệu bị sửa đổi sẽ ném lỗi.
 */
export function decryptAes256GcmBuffer(cipherBuffer: Buffer, password: string): Buffer {
  const minLength = MAGIC_HEADER.length + SALT_LENGTH + IV_LENGTH + TAG_LENGTH;
  if (cipherBuffer.length < minLength) {
    throw new Error('Dữ liệu mã hóa không hợp lệ: Kích thước tệp quá ngắn');
  }

  const magic = cipherBuffer.subarray(0, MAGIC_HEADER.length);
  if (!magic.equals(MAGIC_HEADER)) {
    throw new Error('Định dạng tệp không được hỗ trợ (Sai Magic Bytes header)');
  }

  let offset = MAGIC_HEADER.length;
  const salt = cipherBuffer.subarray(offset, offset + SALT_LENGTH);
  offset += SALT_LENGTH;

  const iv = cipherBuffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;

  const authTag = cipherBuffer.subarray(cipherBuffer.length - TAG_LENGTH);
  const encryptedData = cipherBuffer.subarray(offset, cipherBuffer.length - TAG_LENGTH);

  const key = deriveKeyPbkdf2(password, salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Tạo luồng Transform Stream mã hóa dữ liệu đầu ra bằng AES-256-GCM
 * Phát Header [Magic 8B][Salt 16B][IV 12B] ở chunk đầu tiên và gắn [AuthTag 16B] khi kết thúc.
 */
export function createAes256GcmEncryptStream(password: string): Transform {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKeyPbkdf2(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let isHeaderEmitted = false;

  return new Transform({
    transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
      try {
        if (!isHeaderEmitted) {
          this.push(Buffer.concat([MAGIC_HEADER, salt, iv]));
          isHeaderEmitted = true;
        }
        const encryptedChunk = cipher.update(chunk);
        if (encryptedChunk.length > 0) {
          this.push(encryptedChunk);
        }
        callback();
      } catch (err: unknown) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },
    flush(callback: TransformCallback) {
      try {
        if (!isHeaderEmitted) {
          this.push(Buffer.concat([MAGIC_HEADER, salt, iv]));
        }
        const finalChunk = cipher.final();
        if (finalChunk.length > 0) {
          this.push(finalChunk);
        }
        const authTag = cipher.getAuthTag();
        this.push(authTag);
        callback();
      } catch (err: unknown) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}
