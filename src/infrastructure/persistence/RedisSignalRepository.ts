import Redis from 'ioredis';
import {Signal} from '../../domain/entities/Signal';
import {ISignalRepository} from '../../domain/repositories/ISignalRepository';
import {
    DatabaseConnectionError,
    ExchangeType,
    ILogger,
    IRedisConfig,
    ResourceNotFoundError,
    SerializationError,
    SignalDirection,
    SignalStatus,
} from '../../shared';

export class RedisSignalRepository implements ISignalRepository {
    private redis!: Redis;
    private readonly keyPrefix: string;
    private isConnected: boolean = false;

    constructor(
        private readonly config: IRedisConfig,
        private readonly logger: ILogger
    ) {
        this.keyPrefix = config.keyPrefix;
        this.initializeRedis();
    }

    async save(signal: Signal): Promise<void> {
        try {
            await this.ensureConnection();

            const signalData = JSON.stringify(signal.toPlainObject());
            const pipeline = this.redis.pipeline();

            // Save signal data
            pipeline.hset(this.getSignalsKey(), signal.id, signalData);

            // Add to indexes
            pipeline.sadd(this.getStatusIndexKey(signal.status), signal.id);
            pipeline.sadd(this.getPairIndexKey(signal.pair), signal.id);
            pipeline.sadd(this.getExchangeIndexKey(signal.exchange), signal.id);
            pipeline.sadd(this.getDirectionIndexKey(signal.direction), signal.id);

            // Set expiration (optional - signals expire after 30 days)
            pipeline.expire(this.getSignalKey(signal.id), 30 * 24 * 60 * 60);

            await pipeline.exec();

            this.logger.debug(`Signal ${signal.id} saved to Redis repository`, {
                signalId: signal.id,
                pair: signal.pair,
                status: signal.status
            });
        } catch (error: any) {
            this.logger.error(`Failed to save signal ${signal.id} to Redis:`, error);
            throw new DatabaseConnectionError(`Failed to save signal: ${error.message}`, 'redis');
        }
    }

    async findById(id: string): Promise<Signal | null> {
        try {
            await this.ensureConnection();

            const signalData = await this.redis.hget(this.getSignalsKey(), id);
            if (!signalData) {
                return null;
            }

            return this.deserializeSignal(signalData);
        } catch (error: any) {
            this.logger.error(`Failed to find signal ${id} in Redis:`, error);
            throw new DatabaseConnectionError(`Failed to find signal: ${error.message}`, 'redis');
        }
    }

    async findByStatus(status: SignalStatus): Promise<Signal[]> {
        try {
            await this.ensureConnection();

            const signalIds = await this.redis.smembers(this.getStatusIndexKey(status));
            return this.getSignalsByIds(signalIds);
        } catch (error: any) {
            this.logger.error(`Failed to find signals by status ${status} in Redis:`, error);
            throw new DatabaseConnectionError(`Failed to find signals by status: ${error.message}`, 'redis');
        }
    }

    async findByPair(pair: string): Promise<Signal[]> {
        try {
            await this.ensureConnection();

            const signalIds = await this.redis.smembers(this.getPairIndexKey(pair));
            return this.getSignalsByIds(signalIds);
        } catch (error: any) {
            this.logger.error(`Failed to find signals by pair ${pair} in Redis:`, error);
            throw new DatabaseConnectionError(`Failed to find signals by pair: ${error.message}`, 'redis');
        }
    }

    async findByExchange(exchange: ExchangeType): Promise<Signal[]> {
        try {
            await this.ensureConnection();

            const signalIds = await this.redis.smembers(this.getExchangeIndexKey(exchange));
            return this.getSignalsByIds(signalIds);
        } catch (error: any) {
            this.logger.error(`Failed to find signals by exchange ${exchange} in Redis:`, error);
            throw new DatabaseConnectionError(`Failed to find signals by exchange: ${error.message}`, 'redis');
        }
    }

    async findActive(): Promise<Signal[]> {
        try {
            await this.ensureConnection();

            const pendingIds = await this.redis.smembers(this.getStatusIndexKey(SignalStatus.PENDING));
            const sentIds = await this.redis.smembers(this.getStatusIndexKey(SignalStatus.SENT));

            const allActiveIds = [...pendingIds, ...sentIds];
            return this.getSignalsByIds(allActiveIds);
        } catch (error: any) {
            this.logger.error('Failed to find active signals in Redis:', error);
            throw new DatabaseConnectionError(`Failed to find active signals: ${error.message}`, 'redis');
        }
    }

    async findRecent(hours: number = 24): Promise<Signal[]> {
        try {
            await this.ensureConnection();

            const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
            const allSignalIds = await this.redis.hkeys(this.getSignalsKey());

            const recentSignals: Signal[] = [];

            for (const id of allSignalIds) {
                const signalData = await this.redis.hget(this.getSignalsKey(), id);
                if (signalData) {
                    const signal = this.deserializeSignal(signalData);
                    if (signal.createdAt.getTime() >= cutoffTime) {
                        recentSignals.push(signal);
                    }
                }
            }

            // Sort by creation date (newest first)
            recentSignals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            return recentSignals;
        } catch (error: any) {
            this.logger.error(`Failed to find recent signals (${hours}h) in Redis:`, error);
            throw new DatabaseConnectionError(`Failed to find recent signals: ${error.message}`, 'redis');
        }
    }

    async findWithFilters(filters: {
        status?: SignalStatus;
        pair?: string;
        exchange?: ExchangeType;
        direction?: SignalDirection;
        minConfidence?: number;
        fromDate?: Date;
        toDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<Signal[]> {
        try {
            await this.ensureConnection();

            // Get intersection of all applicable indexes
            const indexKeys: string[] = [];

            if (filters.status) {
                indexKeys.push(this.getStatusIndexKey(filters.status));
            }

            if (filters.pair) {
                indexKeys.push(this.getPairIndexKey(filters.pair));
            }

            if (filters.exchange) {
                indexKeys.push(this.getExchangeIndexKey(filters.exchange));
            }

            if (filters.direction) {
                indexKeys.push(this.getDirectionIndexKey(filters.direction));
            }

            let signalIds: string[];

            if (indexKeys.length === 0) {
                // No index filters, get all signals
                signalIds = await this.redis.hkeys(this.getSignalsKey());
            } else if (indexKeys.length === 1) {
                // Single index
                signalIds = await this.redis.smembers(indexKeys[0] as string);
            } else {
                // Multiple indexes - find intersection
                signalIds = await this.redis.sinter(...indexKeys);
            }

            // Get signals and apply remaining filters
            let filteredSignals = await this.getSignalsByIds(signalIds);

            if (filters.minConfidence) {
                filteredSignals = filteredSignals.filter(signal => signal.confidence >= filters.minConfidence!);
            }

            if (filters.fromDate) {
                filteredSignals = filteredSignals.filter(signal => signal.createdAt >= filters.fromDate!);
            }

            if (filters.toDate) {
                filteredSignals = filteredSignals.filter(signal => signal.createdAt <= filters.toDate!);
            }

            // Sort by creation date (newest first)
            filteredSignals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            // Apply pagination
            if (filters.offset) {
                filteredSignals = filteredSignals.slice(filters.offset);
            }

            if (filters.limit) {
                filteredSignals = filteredSignals.slice(0, filters.limit);
            }

            return filteredSignals;
        } catch (error: any) {
            this.logger.error('Failed to find signals with filters in Redis:', error);
            throw new DatabaseConnectionError(`Failed to find signals with filters: ${error.message}`, 'redis');
        }
    }

    async update(signal: Signal): Promise<void> {
        try {
            await this.ensureConnection();

            // Check if signal exists
            const exists = await this.redis.hexists(this.getSignalsKey(), signal.id);
            if (!exists) {
                throw new ResourceNotFoundError(`Signal ${signal.id} not found`);
            }

            // Get old signal to remove from old indexes
            const oldSignalData = await this.redis.hget(this.getSignalsKey(), signal.id);
            if (oldSignalData) {
                const oldSignal = this.deserializeSignal(oldSignalData);
                await this.removeFromIndexes(oldSignal);
            }

            // Save updated signal
            await this.save(signal);
        } catch (error: any) {
            this.logger.error(`Failed to update signal ${signal.id} in Redis:`, error);
            throw error;
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            await this.ensureConnection();

            // Get signal to remove from indexes
            const signalData = await this.redis.hget(this.getSignalsKey(), id);
            if (!signalData) {
                return false;
            }

            const signal = this.deserializeSignal(signalData);

            const pipeline = this.redis.pipeline();

            // Remove from main storage
            pipeline.hdel(this.getSignalsKey(), id);

            // Remove from indexes
            pipeline.srem(this.getStatusIndexKey(signal.status), id);
            pipeline.srem(this.getPairIndexKey(signal.pair), id);
            pipeline.srem(this.getExchangeIndexKey(signal.exchange), id);
            pipeline.srem(this.getDirectionIndexKey(signal.direction), id);

            const results = await pipeline.exec();
            const deleted = results?.[0]?.[1] === 1;

            if (deleted) {
                this.logger.debug(`Signal ${id} deleted from Redis repository`);
            }

            return deleted;
        } catch (error: any) {
            this.logger.error(`Failed to delete signal ${id} from Redis:`, error);
            throw new DatabaseConnectionError(`Failed to delete signal: ${error.message}`, 'redis');
        }
    }

    async count(): Promise<number> {
        try {
            await this.ensureConnection();
            return await this.redis.hlen(this.getSignalsKey());
        } catch (error: any) {
            this.logger.error('Failed to count signals in Redis:', error);
            throw new DatabaseConnectionError(`Failed to count signals: ${error.message}`, 'redis');
        }
    }

    async clear(): Promise<void> {
        try {
            await this.ensureConnection();

            const pattern = `${this.keyPrefix}*`;
            const keys = await this.redis.keys(pattern);

            if (keys.length > 0) {
                await this.redis.del(...keys);
            }

            this.logger.info('Redis signal repository cleared');
        } catch (error: any) {
            this.logger.error('Failed to clear Redis signal repository:', error);
            throw new DatabaseConnectionError(`Failed to clear repository: ${error.message}`, 'redis');
        }
    }

    async getStatistics(): Promise<{
        total: number;
        byStatus: Record<SignalStatus, number>;
        byExchange: Record<ExchangeType, number>;
        byDirection: Record<SignalDirection, number>;
        avgConfidence: number;
        successRate: number;
    }> {
        try {
            await this.ensureConnection();

            const total = await this.count();

            // Get counts by status
            const byStatus = {} as Record<SignalStatus, number>;
            for (const status of Object.values(SignalStatus)) {
                byStatus[status] = await this.redis.scard(this.getStatusIndexKey(status));
            }

            // Get counts by exchange
            const byExchange = {} as Record<ExchangeType, number>;
            for (const exchange of Object.values(ExchangeType)) {
                byExchange[exchange] = await this.redis.scard(this.getExchangeIndexKey(exchange));
            }

            // Get counts by direction
            const byDirection = {} as Record<SignalDirection, number>;
            for (const direction of Object.values(SignalDirection)) {
                byDirection[direction] = await this.redis.scard(this.getDirectionIndexKey(direction));
            }

            // Calculate average confidence and success rate (requires loading all signals)
            const allSignalIds = await this.redis.hkeys(this.getSignalsKey());
            let totalConfidence = 0;
            let completedCount = 0;
            let successfulCount = 0;

            for (const id of allSignalIds) {
                const signalData = await this.redis.hget(this.getSignalsKey(), id);
                if (signalData) {
                    const signal = this.deserializeSignal(signalData);
                    totalConfidence += signal.confidence;

                    if (signal.status === SignalStatus.EXECUTED || signal.status === SignalStatus.FAILED) {
                        completedCount++;
                        if (signal.status === SignalStatus.EXECUTED) {
                            successfulCount++;
                        }
                    }
                }
            }

            const avgConfidence = total > 0 ? totalConfidence / total : 0;
            const successRate = completedCount > 0 ? (successfulCount / completedCount) * 100 : 0;

            return {
                total,
                byStatus,
                byExchange,
                byDirection,
                avgConfidence: Math.round(avgConfidence * 100) / 100,
                successRate: Math.round(successRate * 100) / 100
            };
        } catch (error: any) {
            this.logger.error('Failed to get signal statistics from Redis:', error);
            throw new DatabaseConnectionError(`Failed to get statistics: ${error.message}`, 'redis');
        }
    }

    // Redis connection management
    async disconnect(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
            this.isConnected = false;
            this.logger.info('Disconnected from Redis');
        }
    }

    // Private methods
    private initializeRedis(): void {
        const host = this.config.url.includes('://')
            ? undefined : this.config.url.split(':')[0];

        const port = this.config.url.includes('://')
            ? undefined : parseInt(this.config.url.split(':')[1]!);

        this.redis = new Redis(port!, host!,{
            connectTimeout: this.config.connectionTimeout,
            commandTimeout: this.config.commandTimeout,
            maxRetriesPerRequest: this.config.retryAttempts,
            password: this.config.password!,
            db: this.config.database,
            keyPrefix: this.config.keyPrefix,
            lazyConnect: true,
            retryStrategy: (times: number) => Math.min(times * 50, 2000),
        });

        this.redis.on('connect', () => {
            this.isConnected = true;
            this.logger.info('Connected to Redis');
        });

        this.redis.on('error', (error) => {
            this.isConnected = false;
            this.logger.error('Redis connection error:', error);
        });

        this.redis.on('close', () => {
            this.isConnected = false;
            this.logger.warn('Redis connection closed');
        });
    }

    private async ensureConnection(): Promise<void> {
        if (!this.isConnected) {
            try {
                await this.redis.connect();
            } catch (error: any) {
                throw new DatabaseConnectionError(`Failed to connect to Redis: ${error.message}`, 'redis');
            }
        }
    }

    private async getSignalsByIds(ids: string[]): Promise<Signal[]> {
        if (ids.length === 0) return [];

        const signalsData = await this.redis.hmget(this.getSignalsKey(), ...ids);
        const signals: Signal[] = [];

        for (const data of signalsData) {
            if (data) {
                try {
                    signals.push(this.deserializeSignal(data));
                } catch (error) {
                    this.logger.warn('Failed to deserialize signal:', error);
                }
            }
        }

        return signals;
    }

    private deserializeSignal(data: string): Signal {
        try {
            const signalData = JSON.parse(data);
            return Signal.fromPersistence(signalData);
        } catch (error: any) {
            throw new SerializationError(`Failed to deserialize signal: ${error.message}`, data);
        }
    }

    private async removeFromIndexes(signal: Signal): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.srem(this.getStatusIndexKey(signal.status), signal.id);
        pipeline.srem(this.getPairIndexKey(signal.pair), signal.id);
        pipeline.srem(this.getExchangeIndexKey(signal.exchange), signal.id);
        pipeline.srem(this.getDirectionIndexKey(signal.direction), signal.id);

        await pipeline.exec();
    }

    // Key generation methods
    private getSignalsKey(): string {
        return `${this.keyPrefix}signals`;
    }

    private getSignalKey(id: string): string {
        return `${this.keyPrefix}signal:${id}`;
    }

    private getStatusIndexKey(status: SignalStatus): string {
        return `${this.keyPrefix}idx:status:${status}`;
    }

    private getPairIndexKey(pair: string): string {
        return `${this.keyPrefix}idx:pair:${pair.toUpperCase()}`;
    }

    private getExchangeIndexKey(exchange: ExchangeType): string {
        return `${this.keyPrefix}idx:exchange:${exchange}`;
    }

    private getDirectionIndexKey(direction: SignalDirection): string {
        return `${this.keyPrefix}idx:direction:${direction}`;
    }
}
