import { Injectable, OnApplicationShutdown, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import neo4j, { Driver, Session, QueryResult } from 'neo4j-driver';

@Injectable()
export class Neo4jService implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const uri = this.config.get<string>('NEO4J_URI');
    const username = this.config.get<string>('NEO4J_USERNAME');
    const password = this.config.get<string>('NEO4J_PASSWORD');

    if (!uri || !username || !password) {
      this.logger.warn('Neo4j credentials not fully provided. Neo4j queries will fail.');
      return;
    }

    try {
      this.driver = neo4j.driver(
        uri,
        neo4j.auth.basic(username, password),
        {
          maxConnectionPoolSize: 25,
          connectionTimeout: 10000,
          maxConnectionLifetime: 60 * 60 * 1000,
        }
      );
      this.logger.log(`Neo4j Driver initialized successfully for URI: ${uri}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Failed to initialize Neo4j Driver: ${msg}`, stack);
    }
  }

  async verifyConnectivity(): Promise<boolean> {
    if (!this.driver) return false;
    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Neo4j Connectivity Check Failed: ${msg}`);
      return false;
    }
  }

  private get defaultDatabase(): string {
    return this.config.get<string>('NEO4J_DATABASE', 'neo4j');
  }

  getSession(database?: string): Session {
    if (!this.driver) {
      throw new Error('Neo4j Driver is not initialized. Please verify configuration.');
    }
    return this.driver.session({ database: database || this.defaultDatabase });
  }

  async runQuery(cypher: string, params: Record<string, unknown> = {}, database?: string): Promise<QueryResult> {
    const session = this.getSession(database || this.defaultDatabase);
    try {
      return await session.run(cypher, params);
    } finally {
      await session.close();
    }
  }

  async onApplicationShutdown() {
    if (this.driver) {
      this.logger.log('Closing Neo4j Driver connections...');
      await this.driver.close();
      this.logger.log('Neo4j Driver closed cleanly.');
    }
  }
}
