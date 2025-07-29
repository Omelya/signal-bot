import * as fs from 'fs/promises';
import * as path from 'path';
import {TradingPair} from '../../domain/entities/TradingPair';
import {IPairRepository} from '../../domain/repositories/IPairRepository';
import {ExchangeType, FileSystemError, ILogger, PairCategory, ResourceNotFoundError,} from '../../shared';


export class FilePairRepository implements IPairRepository {
    private readonly filePath: string;
    private pairs = new Map<string, TradingPair>();
    private isLoaded: boolean = false;

    constructor(
        private readonly dataPath: string,
        private readonly logger: ILogger
    ) {
        this.filePath = path.join(this.dataPath, 'trading-pairs.json');
    }

    async save(pair: TradingPair): Promise<void> {
        try {
            await this.ensureLoaded();

            this.pairs.set(this.getPairKey(pair.symbol, pair.exchange), pair);
            await this.saveToFile();

            this.logger.debug(`Trading pair ${pair.symbol} saved`, {
                symbol: pair.symbol,
                exchange: pair.exchange,
                category: pair.category
            });
        } catch (error) {
            this.logger.error(`Failed to save trading pair ${pair.symbol}:`, error);
            throw error;
        }
    }

    async findBySymbol(symbol: string): Promise<TradingPair[]> {
        try {
            await this.ensureLoaded();

            const normalizedSymbol = symbol.toUpperCase();
            return Array.from(this.pairs.values())
                .filter(pair => pair.symbol === normalizedSymbol);
        } catch (error) {
            this.logger.error(`Failed to find trading pair by symbol ${symbol}:`, error);
            throw error;
        }
    }

    async findByExchange(exchange: ExchangeType): Promise<TradingPair[]> {
        try {
            await this.ensureLoaded();

            return Array.from(this.pairs.values())
                .filter(pair => pair.exchange === exchange);
        } catch (error) {
            this.logger.error(`Failed to find trading pairs by exchange ${exchange}:`, error);
            throw error;
        }
    }

    async findByCategory(category: PairCategory): Promise<TradingPair[]> {
        try {
            await this.ensureLoaded();

            return Array.from(this.pairs.values())
                .filter(pair => pair.category === category);
        } catch (error) {
            this.logger.error(`Failed to find trading pairs by category ${category}:`, error);
            throw error;
        }
    }

    async findActive(): Promise<TradingPair[]> {
        try {
            await this.ensureLoaded();

            return Array.from(this.pairs.values())
                .filter(pair => pair.isActive);
        } catch (error) {
            this.logger.error('Failed to find active trading pairs:', error);
            throw error;
        }
    }

    async findBySymbolAndExchange(symbol: string, exchange: ExchangeType): Promise<TradingPair | null> {
        try {
            await this.ensureLoaded();

            const key = this.getPairKey(symbol, exchange);
            return this.pairs.get(key) || null;
        } catch (error) {
            this.logger.error(`Failed to find trading pair ${symbol} on ${exchange}:`, error);
            throw error;
        }
    }

    async findAll(): Promise<TradingPair[]> {
        try {
            await this.ensureLoaded();
            return Array.from(this.pairs.values());
        } catch (error) {
            this.logger.error('Failed to find all trading pairs:', error);
            throw error;
        }
    }

    async update(pair: TradingPair): Promise<void> {
        try {
            await this.ensureLoaded();

            const key = this.getPairKey(pair.symbol, pair.exchange);
            if (!this.pairs.has(key)) {
                throw new ResourceNotFoundError(`Trading pair ${pair.symbol} on ${pair.exchange} not found`);
            }

            this.pairs.set(key, pair);
            await this.saveToFile();

            this.logger.debug(`Trading pair ${pair.symbol} updated`, {
                symbol: pair.symbol,
                exchange: pair.exchange
            });
        } catch (error) {
            this.logger.error(`Failed to update trading pair ${pair.symbol}:`, error);
            throw error;
        }
    }

    async delete(symbol: string, exchange: ExchangeType): Promise<boolean> {
        try {
            await this.ensureLoaded();

            const key = this.getPairKey(symbol, exchange);
            const deleted = this.pairs.delete(key);

            if (deleted) {
                await this.saveToFile();
                this.logger.debug(`Trading pair ${symbol} deleted from ${exchange}`);
            }

            return deleted;
        } catch (error) {
            this.logger.error(`Failed to delete trading pair ${symbol} from ${exchange}:`, error);
            throw error;
        }
    }

    async count(): Promise<number> {
        try {
            await this.ensureLoaded();
            return this.pairs.size;
        } catch (error) {
            this.logger.error('Failed to count trading pairs:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            this.pairs.clear();
            await this.saveToFile();
            this.logger.info('Trading pairs repository cleared');
        } catch (error) {
            this.logger.error('Failed to clear trading pairs repository:', error);
            throw error;
        }
    }

    async exists(symbol: string, exchange: ExchangeType): Promise<boolean> {
        try {
            await this.ensureLoaded();
            const key = this.getPairKey(symbol, exchange);
            return this.pairs.has(key);
        } catch (error) {
            this.logger.error(`Failed to check if trading pair ${symbol} exists on ${exchange}:`, error);
            throw error;
        }
    }

    async getStatistics(): Promise<{
        total: number;
        active: number;
        byExchange: Record<ExchangeType, number>;
        byCategory: Record<PairCategory, number>;
    }> {
        try {
            await this.ensureLoaded();

            const pairs = Array.from(this.pairs.values());
            const total = pairs.length;
            const active = pairs.filter(pair => pair.isActive).length;

            // Count by exchange
            const byExchange = {} as Record<ExchangeType, number>;
            Object.values(ExchangeType).forEach(exchange => {
                byExchange[exchange] = pairs.filter(pair => pair.exchange === exchange).length;
            });

            // Count by category
            const byCategory = {} as Record<PairCategory, number>;
            Object.values(PairCategory).forEach(category => {
                byCategory[category] = pairs.filter(pair => pair.category === category).length;
            });

            return {
                total,
                active,
                byExchange,
                byCategory
            };
        } catch (error) {
            this.logger.error('Failed to get trading pairs statistics:', error);
            throw error;
        }
    }

    async bulkSave(pairs: TradingPair[]): Promise<void> {
        try {
            await this.ensureLoaded();

            for (const pair of pairs) {
                this.pairs.set(this.getPairKey(pair.symbol, pair.exchange), pair);
            }

            await this.saveToFile();
            this.logger.info(`Bulk saved ${pairs.length} trading pairs`);
        } catch (error) {
            this.logger.error(`Failed to bulk save ${pairs.length} trading pairs:`, error);
            throw error;
        }
    }

    async findWithFilters(filters: {
        exchange?: ExchangeType;
        category?: PairCategory;
        active?: boolean;
        minVolume?: number;
        baseAsset?: string;
        quoteAsset?: string;
    }): Promise<TradingPair[]> {
        try {
            await this.ensureLoaded();

            let pairs = Array.from(this.pairs.values());

            if (filters.exchange) {
                pairs = pairs.filter(pair => pair.exchange === filters.exchange);
            }

            if (filters.category) {
                pairs = pairs.filter(pair => pair.category === filters.category);
            }

            if (filters.active !== undefined) {
                pairs = pairs.filter(pair => pair.isActive === filters.active);
            }

            if (filters.minVolume) {
                pairs = pairs.filter(pair => pair.settings.minVolume >= filters.minVolume!);
            }

            if (filters.baseAsset) {
                const normalizedBase = filters.baseAsset.toUpperCase();
                pairs = pairs.filter(pair => pair.baseAsset === normalizedBase);
            }

            if (filters.quoteAsset) {
                const normalizedQuote = filters.quoteAsset.toUpperCase();
                pairs = pairs.filter(pair => pair.quoteAsset === normalizedQuote);
            }

            return pairs;
        } catch (error) {
            this.logger.error('Failed to find trading pairs with filters:', error);
            throw error;
        }
    }

    // Private methods
    private async ensureLoaded(): Promise<void> {
        if (!this.isLoaded) {
            await this.loadFromFile();
            this.isLoaded = true;
        }
    }

    private async loadFromFile(): Promise<void> {
        try {
            await this.ensureDirectoryExists();

            try {
                const data = await fs.readFile(this.filePath, 'utf-8');
                const pairsData = JSON.parse(data);

                this.pairs.clear();

                for (const pairData of pairsData) {
                    const pair = TradingPair.fromPersistence(pairData);
                    this.pairs.set(this.getPairKey(pair.symbol, pair.exchange), pair);
                }

                this.logger.debug(`Loaded ${this.pairs.size} trading pairs from file`);
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // File doesn't exist yet, start with empty repository
                    this.pairs.clear();
                    this.logger.info('Trading pairs file not found, starting with empty repository');
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            throw new FileSystemError(`Failed to load trading pairs from file: ${error.message}`, this.filePath);
        }
    }

    private async saveToFile(): Promise<void> {
        try {
            await this.ensureDirectoryExists();

            const pairsData = Array.from(this.pairs.values()).map(pair => pair.toPlainObject());
            const data = JSON.stringify(pairsData, null, 2);

            // Write to temporary file first, then rename (atomic operation)
            const tempFilePath = `${this.filePath}.tmp`;
            await fs.writeFile(tempFilePath, data, 'utf-8');
            await fs.rename(tempFilePath, this.filePath);

            this.logger.debug(`Saved ${this.pairs.size} trading pairs to file`);
        } catch (error: any) {
            throw new FileSystemError(`Failed to save trading pairs to file: ${error.message}`, this.filePath);
        }
    }

    private async ensureDirectoryExists(): Promise<void> {
        try {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });
        } catch (error: any) {
            throw new FileSystemError(`Failed to create directory: ${error.message}`, path.dirname(this.filePath));
        }
    }

    private getPairKey(symbol: string, exchange: ExchangeType): string {
        return `${symbol.toUpperCase()}:${exchange}`;
    }
}
