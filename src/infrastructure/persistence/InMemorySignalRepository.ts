import {Signal} from '../../domain/entities/Signal';
import {ISignalRepository} from '../../domain/repositories/ISignalRepository';
import {ExchangeType, ILogger, ResourceNotFoundError, SignalDirection, SignalStatus} from '../../shared';

export class InMemorySignalRepository implements ISignalRepository {
    private signals = new Map<string, Signal>();
    private indexByStatus = new Map<SignalStatus, Set<string>>();
    private indexByPair = new Map<string, Set<string>>();
    private indexByExchange = new Map<ExchangeType, Set<string>>();

    constructor(private readonly logger: ILogger) {
        this.initializeIndexes();
    }

    async save(signal: Signal): Promise<void> {
        try {
            const existingSignal = this.signals.get(signal.id);

            if (existingSignal) {
                this.removeFromIndexes(existingSignal);
            }

            this.signals.set(signal.id, signal);

            this.addToIndexes(signal);
        } catch (error) {
            this.logger.error(`Failed to save signal ${signal.id}:`, error);
            throw error;
        }
    }

    async findById(id: string): Promise<Signal | null> {
        try {
            const signal = this.signals.get(id);
            return signal || null;
        } catch (error) {
            this.logger.error(`Failed to find signal ${id}:`, error);
            throw error;
        }
    }

    async findByStatus(status: SignalStatus): Promise<Signal[]> {
        try {
            const signalIds = this.indexByStatus.get(status) || new Set();

            return Array.from(signalIds)
                .map(id => this.signals.get(id))
                .filter((signal): signal is Signal => signal !== undefined);
        } catch (error) {
            this.logger.error(`Failed to find signals by status ${status}:`, error);
            throw error;
        }
    }

    async findByPair(pair: string): Promise<Signal[]> {
        try {
            const signalIds = this.indexByPair.get(pair.toUpperCase()) || new Set();

            return Array.from(signalIds)
                .map(id => this.signals.get(id))
                .filter((signal): signal is Signal => signal !== undefined);
        } catch (error) {
            this.logger.error(`Failed to find signals by pair ${pair}:`, error);
            throw error;
        }
    }

    async findByExchange(exchange: ExchangeType): Promise<Signal[]> {
        try {
            const signalIds = this.indexByExchange.get(exchange) || new Set();

            return Array.from(signalIds)
                .map(id => this.signals.get(id))
                .filter((signal): signal is Signal => signal !== undefined);
        } catch (error) {
            this.logger.error(`Failed to find signals by exchange ${exchange}:`, error);
            throw error;
        }
    }

    async findActive(): Promise<Signal[]> {
        try {
            const pendingSignals = await this.findByStatus(SignalStatus.PENDING);
            const sentSignals = await this.findByStatus(SignalStatus.SENT);

            return [...pendingSignals, ...sentSignals];
        } catch (error) {
            this.logger.error('Failed to find active signals:', error);
            throw error;
        }
    }

    async findRecent(hours: number = 24): Promise<Signal[]> {
        try {
            const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

            return Array.from(this.signals.values())
                .filter(signal => signal.createdAt >= cutoffTime)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } catch (error) {
            this.logger.error(`Failed to find recent signals (${hours}h):`, error);
            throw error;
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
            let signals = Array.from(this.signals.values());

            // Apply filters
            if (filters.status) {
                signals = signals.filter(signal => signal.status === filters.status);
            }

            if (filters.pair) {
                signals = signals.filter(signal => signal.pair === filters.pair?.toUpperCase());
            }

            if (filters.exchange) {
                signals = signals.filter(signal => signal.exchange === filters.exchange);
            }

            if (filters.direction) {
                signals = signals.filter(signal => signal.direction === filters.direction);
            }

            if (filters.minConfidence) {
                signals = signals.filter(signal => signal.confidence >= filters.minConfidence!);
            }

            if (filters.fromDate) {
                signals = signals.filter(signal => signal.createdAt >= filters.fromDate!);
            }

            if (filters.toDate) {
                signals = signals.filter(signal => signal.createdAt <= filters.toDate!);
            }

            // Sort by creation date (newest first)
            signals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

            // Apply pagination
            if (filters.offset) {
                signals = signals.slice(filters.offset);
            }

            if (filters.limit) {
                signals = signals.slice(0, filters.limit);
            }

            return signals;
        } catch (error) {
            this.logger.error('Failed to find signals with filters:', error);
            throw error;
        }
    }

    async update(signal: Signal): Promise<void> {
        try {
            if (!this.signals.has(signal.id)) {
                throw new ResourceNotFoundError(`Signal ${signal.id} not found`);
            }

            await this.save(signal);
        } catch (error) {
            this.logger.error(`Failed to update signal ${signal.id}:`, error);
            throw error;
        }
    }

    async delete(id: string): Promise<boolean> {
        try {
            const signal = this.signals.get(id);
            if (!signal) {
                return false;
            }

            // Remove from indexes
            this.removeFromIndexes(signal);

            // Remove from main storage
            const deleted = this.signals.delete(id);

            if (deleted) {
                this.logger.debug(`Signal ${id} deleted from in-memory repository`);
            }

            return deleted;
        } catch (error) {
            this.logger.error(`Failed to delete signal ${id}:`, error);
            throw error;
        }
    }

    async count(): Promise<number> {
        return this.signals.size;
    }

    async clear(): Promise<void> {
        try {
            this.signals.clear();
            this.initializeIndexes();
            this.logger.info('In-memory signal repository cleared');
        } catch (error) {
            this.logger.error('Failed to clear in-memory signal repository:', error);
            throw error;
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
            const signals = Array.from(this.signals.values());
            const total = signals.length;

            // Count by status
            const byStatus = {} as Record<SignalStatus, number>;
            Object.values(SignalStatus).forEach(status => {
                byStatus[status] = signals.filter(s => s.status === status).length;
            });

            // Count by exchange
            const byExchange = {} as Record<ExchangeType, number>;
            Object.values(ExchangeType).forEach(exchange => {
                byExchange[exchange] = signals.filter(s => s.exchange === exchange).length;
            });

            // Count by direction
            const byDirection = {} as Record<SignalDirection, number>;
            Object.values(SignalDirection).forEach(direction => {
                byDirection[direction] = signals.filter(s => s.direction === direction).length;
            });

            // Calculate average confidence
            const avgConfidence = total > 0
                ? signals.reduce((sum, s) => sum + s.confidence, 0) / total
                : 0;

            // Calculate success rate
            const completedSignals = signals.filter(s => s.status === SignalStatus.EXECUTED || s.status === SignalStatus.FAILED);
            const successfulSignals = signals.filter(s => s.status === SignalStatus.EXECUTED);
            const successRate = completedSignals.length > 0
                ? (successfulSignals.length / completedSignals.length) * 100
                : 0;

            return {
                total,
                byStatus,
                byExchange,
                byDirection,
                avgConfidence: Math.round(avgConfidence * 100) / 100,
                successRate: Math.round(successRate * 100) / 100
            };
        } catch (error) {
            this.logger.error('Failed to get signal statistics:', error);
            throw error;
        }
    }

    private initializeIndexes(): void {
        this.indexByStatus.clear();
        this.indexByPair.clear();
        this.indexByExchange.clear();

        Object.values(SignalStatus).forEach(status => {
            this.indexByStatus.set(status, new Set());
        });

        Object.values(ExchangeType).forEach(exchange => {
            this.indexByExchange.set(exchange, new Set());
        });
    }

    private addToIndexes(signal: Signal): void {
        const statusSet = this.indexByStatus.get(signal.status);

        if (statusSet) {
            statusSet.add(signal.id);
        }

        const pairKey = signal.pair.toUpperCase();

        if (!this.indexByPair.has(pairKey)) {
            this.indexByPair.set(pairKey, new Set());
        }

        this.indexByPair.get(pairKey)!.add(signal.id);

        const exchangeSet = this.indexByExchange.get(signal.exchange);

        if (exchangeSet) {
            exchangeSet.add(signal.id);
        }
    }

    private removeFromIndexes(signal: Signal): void {
        Object.values(SignalStatus).forEach(status => {
            const statusSet = this.indexByStatus.get(status);

            if (statusSet) {
                statusSet.delete(signal.id);
            }
        });

        const pairKey = signal.pair.toUpperCase();
        const pairSet = this.indexByPair.get(pairKey);

        if (pairSet) {
            pairSet.delete(signal.id);

            if (pairSet.size === 0) {
                this.indexByPair.delete(pairKey);
            }
        }

        const exchangeSet = this.indexByExchange.get(signal.exchange);

        if (exchangeSet) {
            exchangeSet.delete(signal.id);
        }
    }

    async cleanupExpiredSignals(maxAgeMinutes: number = 60): Promise<number> {
        const allActive = await this.findByStatus(SignalStatus.PENDING)
            .then(pending => this.findByStatus(SignalStatus.SENT)
                .then(sent => [...pending, ...sent]));

        const expired = allActive.filter(signal => signal.isExpired(maxAgeMinutes));

        for (const signal of expired) {
            if (signal.status === SignalStatus.SENT) {
                signal.markAsExecuted();
            }

            await this.update(signal);
        }

        this.logger.info(`Cleaned up ${expired.length} expired signals`);
        return expired.length;
    }
}
