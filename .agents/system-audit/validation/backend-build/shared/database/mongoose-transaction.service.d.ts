import { Connection, ClientSession } from 'mongoose';
export declare class MongooseTransactionService {
    private readonly connection;
    private readonly logger;
    constructor(connection: Connection);
    runInTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>;
    private runOnce;
}
