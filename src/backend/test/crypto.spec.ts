import { Readable } from 'stream';
import {
  computeSha256Buffer,
  computeSha256Stream,
  encryptAes256GcmBuffer,
  decryptAes256GcmBuffer,
  createAes256GcmEncryptStream,
  deriveKeyPbkdf2,
} from '../src/shared/crypto/crypto.util';

describe('Cryptographic Engine (crypto.util.ts)', () => {
  const samplePassword = 'StrongPassword123!@#';
  const samplePlaintext = 'id,name,email,score\n1,Alice,alice@example.com,95\n2,Bob,bob@example.com,88';
  const sampleBuffer = Buffer.from(samplePlaintext, 'utf8');

  describe('SHA-256 Hashing', () => {
    it('computeSha256Buffer should produce correct 64-char hex string', () => {
      const hash1 = computeSha256Buffer(sampleBuffer);
      const hash2 = computeSha256Buffer(samplePlaintext);
      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('computeSha256Stream should match computeSha256Buffer', async () => {
      const stream = Readable.from([sampleBuffer]);
      const streamHash = await computeSha256Stream(stream);
      const bufferHash = computeSha256Buffer(sampleBuffer);
      expect(streamHash).toBe(bufferHash);
    });
  });

  describe('AES-256-GCM Buffer Encryption & Decryption', () => {
    it('should successfully encrypt and decrypt data preserving original bytes', () => {
      const encrypted = encryptAes256GcmBuffer(sampleBuffer, samplePassword);
      expect(encrypted).not.toEqual(sampleBuffer);
      expect(encrypted.length).toBeGreaterThan(sampleBuffer.length);

      const decrypted = decryptAes256GcmBuffer(encrypted, samplePassword);
      expect(decrypted.toString('utf8')).toBe(samplePlaintext);
    });

    it('should fail decryption when given wrong password', () => {
      const encrypted = encryptAes256GcmBuffer(sampleBuffer, samplePassword);
      expect(() => {
        decryptAes256GcmBuffer(encrypted, 'WrongPassword123!');
      }).toThrow();
    });

    it('should fail decryption when ciphertext is tampered with (Auth Tag violation)', () => {
      const encrypted = encryptAes256GcmBuffer(sampleBuffer, samplePassword);
      // Alter a single byte in the payload
      encrypted[40] = encrypted[40] ^ 0xff;

      expect(() => {
        decryptAes256GcmBuffer(encrypted, samplePassword);
      }).toThrow();
    });
  });

  describe('AES-256-GCM Streaming Encryption', () => {
    it('should stream encrypted chunks and be decryptable via decryptAes256GcmBuffer', async () => {
      const inputStream = Readable.from([
        Buffer.from('chunk1: hello world\n'),
        Buffer.from('chunk2: tabular data row 1\n'),
        Buffer.from('chunk3: end of file'),
      ]);

      const encryptStream = createAes256GcmEncryptStream(samplePassword);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        inputStream
          .pipe(encryptStream)
          .on('data', (c: Buffer) => chunks.push(c))
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      const fullEncryptedBuffer = Buffer.concat(chunks);
      const decrypted = decryptAes256GcmBuffer(fullEncryptedBuffer, samplePassword);
      expect(decrypted.toString('utf8')).toBe(
        'chunk1: hello world\nchunk2: tabular data row 1\nchunk3: end of file'
      );
    });
  });
});
