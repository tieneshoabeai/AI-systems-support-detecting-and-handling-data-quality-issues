import type { ClientSession } from 'mongoose';
export declare const MongoSessionContext: {
    run<T>(session: ClientSession, fn: () => T): T;
    current(): ClientSession | undefined;
};
export declare function resolveMongoSession(session?: ClientSession): ClientSession | undefined;
