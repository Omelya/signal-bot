import { IExchangeRepository } from '../../domain/repositories/IExchangeRepository';
import { IPairRepository } from '../../domain/repositories/IPairRepository';
import { IGenerateSignalUseCase } from './GenerateSignalUseCase';
import { MarketData } from '../../domain/entities/MarketData';
import { TradingPair } from '../../domain/entities/TradingPair';
import { Exchange } from '../../domain/entities/Exchange';
import { IEventBus } from '../../shared';
import { ILogger } from '../../shared';
import { DomainError } from '../../shared';
import { IMarketDataEventPayload } from '../../shared';
import {ExchangeType, TimeFrame} from '../../shared';
import {IExchangeFactory} from "../../infrastructure/exchanges/factories/ExchangeFactory";

export interface IMonitorMarketUseCase {
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
    monitorSinglePair(pairId: string, exchange: ExchangeType): Promise<void>;
    monitorExchange(exchangeType: string): Promise<void>;
    isMonitoring(): boolean;
    getMonitoringStatus(): Promise<IMonitoringStatus>;
}

export interface IMonitoringStatus {
    isActive: boolean;
    startTime?: Date;
    totalPairsMonitored: number;
    activePairs: string[];
    activeExchanges: string[];
    lastUpdateTime: Date;
    signalsGeneratedToday: number;
    errorCount: number;
    averageLatency: number;
}

export class MonitorMarketUseCase implements IMonitorMarketUseCase {
    private isActive: boolean = false;
    private startTime?: Date;
    private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
    private totalPairsMonitored: number = 0;
    private signalsGeneratedToday: number = 0;
    private errorCount: number = 0;
    private latencies: number[] = [];

    constructor(
        private readonly exchangeFactory: IExchangeFactory,
        private readonly exchangeRepository: IExchangeRepository,
        private readonly pairRepository: IPairRepository,
        private readonly generateSignalUseCase: IGenerateSignalUseCase,
        private readonly eventBus: IEventBus,
        private readonly logger: ILogger
    ) {}

    async startMonitoring(): Promise<void> {
        if (this.isActive) {
            throw new DomainError('Market monitoring is already active');
        }

        this.logger.info('🚀 Starting market monitoring...');

        try {
            // Get all active trading pairs
            const activePairs = await this.pairRepository.findActive();
            if (activePairs.length === 0) {
                throw new DomainError('No active trading pairs found');
            }

            // Get all connected exchanges
            const exchanges = await this.exchangeRepository.findAll();
            if (exchanges.length === 0) {
                throw new DomainError('No connected exchanges found');
            }

            this.isActive = true;
            this.startTime = new Date();
            this.totalPairsMonitored = activePairs.length;

            this.logger.info(`Monitoring ${activePairs.length} pairs across ${exchanges.length} exchanges`);

            // Start monitoring each pair
            for (const pair of activePairs) {
                await this.startPairMonitoring(pair);
            }

            // Publish monitoring started event
            await this.eventBus.publish({
                type: 'monitoring.started',
                source: 'MonitorMarketUseCase',
                version: '1.0',
                payload: {
                    totalPairs: activePairs.length,
                    exchanges: exchanges.map(e => e.type),
                    startTime: this.startTime.toISOString()
                }
            });

            this.logger.info('✅ Market monitoring started successfully');

        } catch (error) {
            this.isActive = false;
            this.logger.error('❌ Failed to start market monitoring:', error);
            throw error;
        }
    }

    async stopMonitoring(): Promise<void> {
        if (!this.isActive) {
            this.logger.warn('Market monitoring is not active');
            return;
        }

        this.logger.info('🛑 Stopping market monitoring...');

        // Clear all monitoring intervals
        for (const [pairId, interval] of this.monitoringIntervals) {
            clearInterval(interval);
            this.logger.debug(`Stopped monitoring for pair: ${pairId}`);
        }

        this.monitoringIntervals.clear();
        this.isActive = false;

        // Publish monitoring stopped event
        await this.eventBus.publish({
            type: 'monitoring.stopped',
            source: 'MonitorMarketUseCase',
            version: '1.0',
            payload: {
                duration: this.startTime ? Date.now() - this.startTime.getTime() : 0,
                totalPairsMonitored: this.totalPairsMonitored,
                signalsGenerated: this.signalsGeneratedToday,
                errorCount: this.errorCount
            }
        });

        this.logger.info('✅ Market monitoring stopped');
    }

    async monitorSinglePair(pairId: string, exchange: ExchangeType): Promise<void> {
        const pair = await this.pairRepository.findBySymbolAndExchange(pairId, exchange);
        if (!pair) {
            throw new DomainError(`Trading pair not found: ${pairId}`);
        }

        if (!pair.isActive) {
            throw new DomainError(`Trading pair is not active: ${pairId}`);
        }

        await this.startPairMonitoring(pair);
        this.logger.info(`Started monitoring single pair: ${pair.symbol}`);
    }

    async monitorExchange(exchangeType: string): Promise<void> {
        const exchange = await this.exchangeRepository.findByType(exchangeType as any);
        if (!exchange) {
            throw new DomainError(`Exchange not found: ${exchangeType}`);
        }

        const pairs = await this.pairRepository.findByExchange(exchange.type);
        const activePairs = pairs.filter(p => p.isActive);

        if (activePairs.length === 0) {
            throw new DomainError(`No active pairs found for exchange: ${exchangeType}`);
        }

        for (const pair of activePairs) {
            await this.startPairMonitoring(pair);
        }

        this.logger.info(`Started monitoring ${activePairs.length} pairs for exchange: ${exchangeType}`);
    }

    isMonitoring(): boolean {
        return this.isActive;
    }

    async getMonitoringStatus(): Promise<IMonitoringStatus> {
        const activePairs = Array.from(this.monitoringIntervals.keys());
        const exchanges = await this.exchangeRepository.findAll();

        const averageLatency = this.latencies.length > 0
            ? this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length
            : 0;

        return {
            isActive: this.isActive,
            startTime: this.startTime,
            totalPairsMonitored: this.totalPairsMonitored,
            activePairs,
            activeExchanges: exchanges.map(e => e.type),
            lastUpdateTime: new Date(),
            signalsGeneratedToday: this.signalsGeneratedToday,
            errorCount: this.errorCount,
            averageLatency: Math.round(averageLatency)
        } as IMonitoringStatus;
    }

    private async startPairMonitoring(pair: TradingPair): Promise<void> {
        // Stop existing monitoring for this pair if it exists
        const existingInterval = this.monitoringIntervals.get(pair.symbol);
        if (existingInterval) {
            clearInterval(existingInterval);
        }

        // Get exchange for this pair
        const exchange = await this.exchangeRepository.findByType(pair.exchange);
        if (!exchange) {
            this.logger.error(`Exchange not found for pair ${pair.symbol}: ${pair.exchange}`);
            return;
        }

        if (!exchange.isHealthy()) {
            this.logger.warn(`Exchange ${pair.exchange} is not healthy, skipping pair ${pair.symbol}`);
            return;
        }

        // Calculate monitoring interval based on timeframe
        const monitoringInterval = this.calculateMonitoringInterval(pair.strategy.timeframe);

        // Start interval monitoring
        const interval = setInterval(async () => {
            await this.monitorPairMarketData(pair, exchange);
        }, monitoringInterval);

        this.monitoringIntervals.set(pair.symbol, interval);

        // Do initial check immediately
        await this.monitorPairMarketData(pair, exchange);

        this.logger.debug(`Started monitoring ${pair.symbol} with interval ${monitoringInterval}ms`);
    }

    private async monitorPairMarketData(pair: TradingPair, exchange: Exchange): Promise<void> {
        const startTime = Date.now();

        try {
            // Check if pair should be auto-disabled due to poor performance
            if (pair.shouldAutoDisable()) {
                this.logger.warn(`Auto-disabling pair ${pair.symbol} due to poor performance`);
                pair.deactivate();
                await this.pairRepository.save(pair);

                // Stop monitoring this pair
                const interval = this.monitoringIntervals.get(pair.symbol);
                if (interval) {
                    clearInterval(interval);
                    this.monitoringIntervals.delete(pair.symbol);
                }
                return;
            }

            // Get market data from exchange
            const marketData = await this.fetchMarketData(pair, exchange);

            // Update market data event
            await this.publishMarketDataEvent(marketData, pair);

            // Try to generate signal
            const signal = await this.generateSignalUseCase.execute(marketData, pair);

            if (signal) {
                this.signalsGeneratedToday++;
                pair.markSignalAsSuccessful(); // Assume success for now
                await this.pairRepository.save(pair);

                this.logger.info(`Signal generated for ${pair.symbol}`, {
                    signalId: signal.id,
                    direction: signal.direction,
                    confidence: signal.confidence
                });
            }

            // Track latency
            const latency = Date.now() - startTime;
            this.trackLatency(latency);

        } catch (error: any) {
            this.errorCount++;
            this.logger.error(`Error monitoring ${pair.symbol}:`, error);

            // Publish error event
            await this.eventBus.publish({
                type: 'monitoring.error',
                source: 'MonitorMarketUseCase',
                version: '1.0',
                payload: {
                    pair: pair.symbol,
                    exchange: exchange.type,
                    error: error.message,
                    errorCount: this.errorCount
                }
            });

            // If too many errors, temporarily disable pair
            if (this.errorCount > 10) {
                this.logger.warn(`Too many errors, temporarily disabling ${pair.symbol}`);
                pair.deactivate();
                await this.pairRepository.save(pair);
            }
        }
    }

    private async fetchMarketData(pair: TradingPair, exchange: Exchange): Promise<MarketData> {
        const adapter = this.exchangeFactory.getAdapter(exchange.type)!;
        const candles = await adapter.getCandles(pair.symbol, pair.strategy.timeframe, 100);

        return MarketData.create({
            symbol: pair.symbol,
            timeframe: pair.strategy.timeframe,
            candles,
            exchange: exchange.type
        });
    }

    private async publishMarketDataEvent(marketData: MarketData, pair: TradingPair): Promise<void> {
        const payload: IMarketDataEventPayload = {
            symbol: marketData.symbol,
            exchange: marketData.exchange,
            timeframe: marketData.timeframe,
            timestamp: marketData.timestamp,
            candleCount: marketData.candleCount,
            price: marketData.currentPrice,
            volume: marketData.latestCandle.volume
        };

        await this.eventBus.publish({
            type: 'market.data.updated',
            source: 'MonitorMarketUseCase',
            version: '1.0',
            payload
        });
    }

    private calculateMonitoringInterval(timeframe: TimeFrame): number {
        // Base intervals in milliseconds
        const intervals = {
            [TimeFrame.ONE_MINUTE]: 15000,     // 15 seconds
            [TimeFrame.FIVE_MINUTES]: 30000,   // 30 seconds
            [TimeFrame.FIFTEEN_MINUTES]: 60000, // 1 minute
            [TimeFrame.ONE_HOUR]: 120000,      // 2 minutes
            [TimeFrame.FOUR_HOURS]: 300000,    // 5 minutes
            [TimeFrame.ONE_DAY]: 600000        // 10 minutes
        } as Record<TimeFrame, number>;

        return intervals[timeframe] || 60000; // Default to 1 minute
    }

    private trackLatency(latency: number): void {
        this.latencies.push(latency);

        // Keep only last 100 latency measurements
        if (this.latencies.length > 100) {
            this.latencies.shift();
        }
    }
}
