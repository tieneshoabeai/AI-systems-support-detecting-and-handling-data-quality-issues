import { ConfigService } from '@nestjs/config';
import { type PasswordHasherPort } from '../../domain/ports/auth-session.port';
export declare class BcryptHasherAdapter implements PasswordHasherPort {
    private readonly saltRounds;
    constructor(config: ConfigService);
    hash(plain: string): Promise<string>;
    compare(plain: string, hash: string): Promise<boolean>;
}
