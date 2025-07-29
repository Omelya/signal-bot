import { Exchange } from '../../domain/entities/Exchange';
import { IExchangeRepository } from '../../domain/repositories/IExchangeRepository';
import { ExchangeType, ILogger, ResourceNotFoundError } from '../../shared';

export class InMemoryExchangeRepository implements IExchangeRepository {
    private exchanges = new Map<ExchangeType, Exchange>();

    constructor(private readonly logger: ILogger) {}

    async save(exchange: Exchange): Promise<void> {
        try {
            this.exchanges.set(exchange.type, exchange);

            this.logger.debug(`Exchange ${exchange.type} saved to repository`, {
                type: exchange.type,
                isInitialized: exchange.isInitialized,
                healthScore: exchange.getHealthScore()
            });
        } catch (error) {
            this.logger.error(`Failed to save exchange ${exchange.type}:`, error);
            throw error;
        }
    }

    async findByType(type: ExchangeType): Promise<Exchange | null> {
        try {
            return this.exchanges.get(type) || null;
        } catch (error) {
            this.logger.error(`Failed to find exchange ${type}:`, error);
            throw error;
        }
    }

    async findAll(): Promise<Exchange[]> {
        try {
            return Array.from(this.exchanges.values());
        } catch (error) {
            this.logger.error('Failed to find all exchanges:', error);
            throw error;
        }
    }

    async findInitialized(): Promise<Exchange[]> {
        try {
            return Array.from(this.exchanges.values())
                .filter(exchange => exchange.isInitialized);
        } catch (error) {
            this.logger.error('Failed to find initialized exchanges:', error);
            throw error;
        }
    }

    async findHealthy(minHealthScore: number = 70): Promise<Exchange[]> {
        try {
            return Array.from(this.exchanges.values())
                .filter(exchange => exchange.getHealthScore() >= minHealthScore);
        } catch (error) {
            this.logger.error(`Failed to find healthy exchanges (min score: ${minHealthScore}):`, error);
            throw error;
        }
    }

    async update(exchange: Exchange): Promise<void> {
        try {
            if (!this.exchanges.has(exchange.type)) {
                throw new ResourceNotFoundError(`Exchange ${exchange.type} not found`);
            }

            this.exchanges.set(exchange.type, exchange);

            this.logger.debug(`Exchange ${exchange.type} updated`, {
                type: exchange.type,
                healthScore: exchange.getHealthScore()
            });
        } catch (error) {
            this.logger.error(`Failed to update exchange ${exchange.type}:`, error);
            throw error;
        }
    }

    async delete(type: ExchangeType): Promise<boolean> {
        try {
            const deleted = this.exchanges.delete(type);

            if (deleted) {
                this.logger.debug(`Exchange ${type} deleted from repository`);
            }

            return deleted;
        } catch (error) {
            this.logger.error(`Failed to delete exchange ${type}:`, error);
            throw error;
        }
    }

    async exists(type: ExchangeType): Promise<boolean> {
        try {
            return this.exchanges.has(type);
        } catch (error) {
            this.logger.error(`Failed to check if exchange ${type} exists:`, error);
            throw error;
        }
    }

    async count(): Promise<number> {
        return this.exchanges.size;
    }

    async clear(): Promise<void> {
        try {
            this.exchanges.clear();
            this.logger.info('Exchange repository cleared');
        } catch (error) {
            this.logger.error('Failed to clear exchange repository:', error);
            throw error;
        }
    }

    async getStatistics(): Promise<{
        total: number;
        initialized: number;
        healthy: number;
        byType: Record<ExchangeType, {
            exists: boolean;
            initialized: boolean;
            healthScore: number;
            isConnected: boolean;
        }>;
    }> {
        try {
            const exchanges = Array.from(this.exchanges.values());
            const total = exchanges.length;
            const initialized = exchanges.filter(ex => ex.isInitialized).length;
            const healthy = exchanges.filter(ex => ex.getHealthScore() >= 70).length;

            const byType = {} as Record<ExchangeType, {
                exists: boolean;
                initialized: boolean;
                healthScore: number;
                isConnected: boolean;
            }>;

            // Initialize all exchange types
            Object.values(ExchangeType).forEach(type => {
                const exchange = this.exchanges.get(type);
                byType[type] = {
                    exists: !!exchange,
                    initialized: exchange?.isInitialized || false,
                    healthScore: exchange?.getHealthScore() || 0,
                    isConnected: exchange?.status.isConnected || false
                };
            });

            return {
                total,
                initialized,
                healthy,
                byType
            };
        } catch (error) {
            this.logger.error('Failed to get exchange statistics:', error);
            throw error;
        }
    }

    async findByHealthRange(minScore: number, maxScore: number = 100): Promise<Exchange[]> {
        try {
            return Array.from(this.exchanges.values())
                .filter(exchange => {
                    const score = exchange.getHealthScore();
                    return score >= minScore && score <= maxScore;
                });
        } catch (error) {
            this.logger.error(`Failed to find exchanges by health range (${minScore}-${maxScore}):`, error);
            throw error;
        }
    }

    async getHealthScores(): Promise<Map<ExchangeType, number>> {
        try {
            const scores = new Map<ExchangeType, number>();

            for (const [type, exchange] of this.exchanges) {
                scores.set(type, exchange.getHealthScore());
            }

            return scores;
        } catch (error) {
            this.logger.error('Failed to get health scores:', error);
            throw error;
        }
    }
}
