"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KEY_LENGTH = exports.PBKDF2_ITERATIONS = exports.TAG_LENGTH = exports.IV_LENGTH = exports.SALT_LENGTH = exports.MAGIC_HEADER = void 0;
exports.computeSha256Buffer = computeSha256Buffer;
exports.computeSha256Stream = computeSha256Stream;
exports.deriveKeyPbkdf2 = deriveKeyPbkdf2;
exports.encryptAes256GcmBuffer = encryptAes256GcmBuffer;
exports.decryptAes256GcmBuffer = decryptAes256GcmBuffer;
exports.createAes256GcmEncryptStream = createAes256GcmEncryptStream;
const crypto = __importStar(require("crypto"));
const stream_1 = require("stream");
exports.MAGIC_HEADER = Buffer.from('DATAQUAL', 'utf8');
exports.SALT_LENGTH = 16;
exports.IV_LENGTH = 12;
exports.TAG_LENGTH = 16;
exports.PBKDF2_ITERATIONS = 100000;
exports.KEY_LENGTH = 32;
function computeSha256Buffer(data) {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}
function computeSha256Stream(stream) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}
function deriveKeyPbkdf2(password, salt) {
    return crypto.pbkdf2Sync(password, salt, exports.PBKDF2_ITERATIONS, exports.KEY_LENGTH, 'sha512');
}
function encryptAes256GcmBuffer(plainBuffer, password) {
    const salt = crypto.randomBytes(exports.SALT_LENGTH);
    const iv = crypto.randomBytes(exports.IV_LENGTH);
    const key = deriveKeyPbkdf2(password, salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([exports.MAGIC_HEADER, salt, iv, encrypted, authTag]);
}
function decryptAes256GcmBuffer(cipherBuffer, password) {
    const minLength = exports.MAGIC_HEADER.length + exports.SALT_LENGTH + exports.IV_LENGTH + exports.TAG_LENGTH;
    if (cipherBuffer.length < minLength) {
        throw new Error('Dữ liệu mã hóa không hợp lệ: Kích thước tệp quá ngắn');
    }
    const magic = cipherBuffer.subarray(0, exports.MAGIC_HEADER.length);
    if (!magic.equals(exports.MAGIC_HEADER)) {
        throw new Error('Định dạng tệp không được hỗ trợ (Sai Magic Bytes header)');
    }
    let offset = exports.MAGIC_HEADER.length;
    const salt = cipherBuffer.subarray(offset, offset + exports.SALT_LENGTH);
    offset += exports.SALT_LENGTH;
    const iv = cipherBuffer.subarray(offset, offset + exports.IV_LENGTH);
    offset += exports.IV_LENGTH;
    const authTag = cipherBuffer.subarray(cipherBuffer.length - exports.TAG_LENGTH);
    const encryptedData = cipherBuffer.subarray(offset, cipherBuffer.length - exports.TAG_LENGTH);
    const key = deriveKeyPbkdf2(password, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}
function createAes256GcmEncryptStream(password) {
    const salt = crypto.randomBytes(exports.SALT_LENGTH);
    const iv = crypto.randomBytes(exports.IV_LENGTH);
    const key = deriveKeyPbkdf2(password, salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let isHeaderEmitted = false;
    return new stream_1.Transform({
        transform(chunk, _encoding, callback) {
            try {
                if (!isHeaderEmitted) {
                    this.push(Buffer.concat([exports.MAGIC_HEADER, salt, iv]));
                    isHeaderEmitted = true;
                }
                const encryptedChunk = cipher.update(chunk);
                if (encryptedChunk.length > 0) {
                    this.push(encryptedChunk);
                }
                callback();
            }
            catch (err) {
                callback(err instanceof Error ? err : new Error(String(err)));
            }
        },
        flush(callback) {
            try {
                if (!isHeaderEmitted) {
                    this.push(Buffer.concat([exports.MAGIC_HEADER, salt, iv]));
                }
                const finalChunk = cipher.final();
                if (finalChunk.length > 0) {
                    this.push(finalChunk);
                }
                const authTag = cipher.getAuthTag();
                this.push(authTag);
                callback();
            }
            catch (err) {
                callback(err instanceof Error ? err : new Error(String(err)));
            }
        },
    });
}
//# sourceMappingURL=crypto.util.js.map