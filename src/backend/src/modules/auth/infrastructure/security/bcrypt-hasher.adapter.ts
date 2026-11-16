import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PASSWORD_HASHER_PORT, type PasswordHasherPort } from '../../domain/ports/auth-session.port';

/** Bcrypt adapter (driven) — nơi duy nhất chạm bcrypt. */
@Injectable()
export class BcryptHasherAdapter implements PasswordHasherPort {
  private readonly saltRounds: number;
  constructor(config: ConfigService) {
    this.saltRounds = config.get<number>('SALT_ROUNDS', 12);
  }
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
