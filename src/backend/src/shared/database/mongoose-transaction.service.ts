import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { MongoSessionContext } from './mongo-session-context';

@Injectable()
export class MongooseTransactionService {
  private readonly logger = new Logger(MongooseTransactionService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection
  ) {}

  /**
   * Thực thi một khối nghiệp vụ trong MongoDB Multi-document Transaction an toàn
   * Tự động khởi tạo session, mở transaction, commit khi thành công và rollback khi gặp lỗi
   */
  async runInTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await this.runOnce(session, fn);
    } finally {
      await session.endSession();
    }
  }

  private async runOnce<T>(
    session: ClientSession,
    fn: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    let result: T | undefined;
    let executed = false;

    await session.withTransaction(async () => {
      executed = false;
      result = await MongoSessionContext.run(session, () => fn(session));
      executed = true;
    });

    if (!executed) {
      throw new Error('Giao dịch hoàn tất nhưng callback không được thực thi thành công');
    }

    return result as T;
  }
}
