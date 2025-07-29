import {IEvent} from '../../shared';
import { Signal } from '../entities/Signal';
import { MarketData } from '../entities/MarketData';
import { TradingPair } from '../entities/TradingPair';
import { Exchange } from '../entities/Exchange';

// Signal Events
export interface SignalGeneratedEvent extends IEvent {
    type: 'signal.generated';
    payload: {
        signalId: string;
        pair: string;
        direction: string;
        entry: number;
        confidence: number;
        exchange: string;
        strategy: string;
        reasoning: string[];
        timestamp: number;
    };
}

export interface SignalSentEvent extends IEvent {
    type: 'signal.sent';
    payload: {
        signalId: string;
        pair: string;
        channels: string[];
        timestamp: number;
    };
}

export interface SignalExecutedEvent extends IEvent {
    type: 'signal.executed';
    payload: {
        signalId: string;
        pair: string;
        executedAt: number;
        result?: 'profit' | 'loss' | 'breakeven';
    };
}

export interface SignalFailedEvent extends IEvent {
    type: 'signal.failed';
    payload: {
        signalId: string;
        pair: string;
        reason: string;
        failedAt: number;
    };
}

// Market Data Events
export interface MarketDataUpdatedEvent extends IEvent {
    type: 'market_data.updated';
    payload: {
        symbol: string;
        exchange: string;
        timeframe: string;
        candleCount: number;
        price: number;
        volume: number;
        timestamp: number;
    };
}

export interface MarketAnalysisCompletedEvent extends IEvent {
    type: 'market_analysis.completed';
    payload: {
        symbol: string;
        exchange: string;
        trend: string;
        strength: number;
        confidence: number;
        recommendation: string;
        timestamp: number;
    };
}

// Exchange Events
export interface ExchangeConnectedEvent extends IEvent {
    type: 'exchange.connected';
    payload: {
        exchange: string;
        latency: number;
        timestamp: number;
    };
}

export interface ExchangeDisconnectedEvent extends IEvent {
    type: 'exchange.disconnected';
    payload: {
        exchange: string;
        reason?: string;
        timestamp: number;
    };
}

export interface ExchangeErrorEvent extends IEvent {
    type: 'exchange.error';
    payload: {
        exchange: string;
        error: string;
        errorCode?: string;
        timestamp: number;
    };
}

// Trading Pair Events
export interface PairAddedEvent extends IEvent {
    type: 'pair.added';
    payload: {
        symbol: string;
        exchange: string;
        category: string;
        isActive: boolean;
        timestamp: number;
    };
}

export interface PairActivatedEvent extends IEvent {
    type: 'pair.activated';
    payload: {
        symbol: string;
        exchange: string;
        timestamp: number;
    };
}

export interface PairDeactivatedEvent extends IEvent {
    type: 'pair.deactivated';
    payload: {
        symbol: string;
        exchange: string;
        reason?: string;
        timestamp: number;
    };
}

// Bot Events
export interface BotStartedEvent extends IEvent {
    type: 'bot.started';
    payload: {
        mode: string;
        activeExchanges: string[];
        activePairs: number;
        timestamp: number;
    };
}

export interface BotStoppedEvent extends IEvent {
    type: 'bot.stopped';
    payload: {
        reason?: string;
        uptime: number;
        signalsGenerated: number;
        timestamp: number;
    };
}

// Risk Events
export interface RiskLimitExceededEvent extends IEvent {
    type: 'risk.limit_exceeded';
    payload: {
        riskType: string;
        currentValue: number;
        threshold: number;
        pair?: string;
        exchange?: string;
        action: string;
        timestamp: number;
    };
}

export interface EmergencyStopTriggeredEvent extends IEvent {
    type: 'risk.emergency_stop';
    payload: {
        reason: string;
        triggeredBy: string;
        affectedPairs: string[];
        timestamp: number;
    };
}

// Utility functions for creating events
export class DomainEventFactory {
    static createSignalGeneratedEvent(signal: Signal, analysis: any): SignalGeneratedEvent {
        return {
            id: `signal_generated_${signal.id}`,
            type: 'signal.generated',
            source: 'SignalGenerated',
            version: '1.0',
            timestamp: Date.now(),
            payload: {
                signalId: signal.id,
                pair: signal.pair,
                direction: signal.direction,
                entry: signal.entry.value,
                confidence: signal.confidence,
                exchange: signal.exchange,
                strategy: signal.strategy,
                reasoning: [...signal.reasoning],
                timestamp: signal.createdAt.getTime()
            }
        };
    }

    static createMarketDataUpdatedEvent(marketData: MarketData): MarketDataUpdatedEvent {
        return {
            id: `market_data_${marketData.symbol}_${Date.now()}`,
            type: 'market_data.updated',
            source: 'MarketData',
            version: '1.0',
            timestamp: Date.now(),
            payload: {
                symbol: marketData.symbol,
                exchange: marketData.exchange,
                timeframe: marketData.timeframe,
                candleCount: marketData.candleCount,
                price: marketData.currentPrice,
                volume: marketData.latestCandle.volume,
                timestamp: marketData.timestamp
            }
        };
    }

    static createExchangeConnectedEvent(exchange: Exchange, latency: number): ExchangeConnectedEvent {
        return {
            id: `exchange_connected_${exchange.type}_${Date.now()}`,
            type: 'exchange.connected',
            source: 'ExchangeConnected',
            version: '1.0',
            timestamp: Date.now(),
            payload: {
                exchange: exchange.type,
                latency,
                timestamp: Date.now()
            }
        };
    }

    static createPairActivatedEvent(pair: TradingPair): PairActivatedEvent {
        return {
            id: `pair_activated_${pair.symbol}_${pair.exchange}_${Date.now()}`,
            type: 'pair.activated',
            source: 'PairActivated',
            version: '1.0',
            timestamp: Date.now(),
            payload: {
                symbol: pair.symbol,
                exchange: pair.exchange,
                timestamp: Date.now()
            }
        };
    }

    static createRiskLimitExceededEvent(
        riskType: string,
        currentValue: number,
        threshold: number,
        action: string,
        context?: { pair?: string; exchange?: string }
    ): RiskLimitExceededEvent {
        return {
            id: `risk_limit_${riskType}_${Date.now()}`,
            type: 'risk.limit_exceeded',
            source: 'RiskLimitExceeded',
            version: '1.0',
            timestamp: Date.now(),
            payload: {
                riskType,
                currentValue,
                threshold,
                pair: context?.pair,
                exchange: context?.exchange,
                action,
                timestamp: Date.now()
            }
        } as RiskLimitExceededEvent;
    }
}
