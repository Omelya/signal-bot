import {SignalDirection, SignalStatus, ISignalTargets, ISignalCreateParams} from '../../shared';
import { Price } from '../valueObjects/Price';
import { UniqueId } from '../valueObjects/UniqueId';
import { DomainError } from '../../shared';
import {ExchangeType} from "../../shared";

export class Signal {
    private constructor(
        private readonly _id: UniqueId,
        private readonly _pair: string,
        private readonly _direction: SignalDirection,
        private readonly _entry: Price,
        private readonly _targets: ISignalTargets,
        private readonly _confidence: number,
        private readonly _reasoning: readonly string[],
        private readonly _exchange: ExchangeType,
        private readonly _timeframe: string,
        private readonly _strategy: string,
        private _status: SignalStatus = SignalStatus.PENDING,
        private readonly _createdAt: Date = new Date(),
        private _sentAt?: Date,
        private _executedAt?: Date
    ) {
        this.validateConfidence();
        this.validateTargets();
        this.validateReasoning();
    }

    /**
     * Factory method to create a new Signal
     */
    static create(params: ISignalCreateParams): Signal {
        return new Signal(
            UniqueId.generate(),
            params.pair.toUpperCase(),
            params.direction,
            params.entry,
            params.targets,
            params.confidence,
            params.reasoning,
            params.exchange,
            params.timeframe,
            params.strategy
        );
    }

    /**
     * Factory method to reconstruct Signal from persistence
     */
    static fromPersistence(data: {
        id: string;
        pair: string;
        direction: SignalDirection;
        entry: number;
        targets: ISignalTargets;
        confidence: number;
        reasoning: string[];
        exchange: ExchangeType;
        timeframe: string;
        strategy: string;
        status: SignalStatus;
        createdAt: Date;
        sentAt?: Date;
        executedAt?: Date;
    }): Signal {
        return new Signal(
            UniqueId.fromString(data.id),
            data.pair,
            data.direction,
            Price.fromNumber(data.entry),
            data.targets,
            data.confidence,
            data.reasoning,
            data.exchange,
            data.timeframe,
            data.strategy,
            data.status,
            data.createdAt,
            data.sentAt,
            data.executedAt
        );
    }

    get id(): string { return this._id.value; }

    get pair(): string { return this._pair; }

    get direction(): SignalDirection { return this._direction; }

    get entry(): Price { return this._entry; }

    get targets(): ISignalTargets { return this._targets; }

    get confidence(): number { return this._confidence; }

    get reasoning(): readonly string[] { return this._reasoning; }

    get status(): SignalStatus { return this._status; }

    get exchange(): ExchangeType { return this._exchange; }

    get timeframe(): string { return this._timeframe; }

    get strategy(): string { return this._strategy; }

    get createdAt(): Date { return this._createdAt; }

    get sentAt(): Date | undefined { return this._sentAt; }

    get executedAt(): Date | undefined { return this._executedAt; }

    /**
     * Mark signal as sent
     */
    public markAsSent(): void {
        if (this._status !== SignalStatus.PENDING) {
            throw new DomainError('Can only mark pending signals as sent');
        }

        this._status = SignalStatus.SENT;
        this._sentAt = new Date();
    }

    /**
     * Mark signal as executed
     */
    public markAsExecuted(): void {
        if (this._status !== SignalStatus.SENT) {
            throw new DomainError('Can only mark sent signals as executed');
        }
        this._status = SignalStatus.EXECUTED;
        this._executedAt = new Date();
    }

    /**
     * Mark signal as failed
     */
    public markAsFailed(): void {
        if (this._status === SignalStatus.EXECUTED) {
            throw new DomainError('Cannot mark executed signals as failed');
        }
        this._status = SignalStatus.FAILED;
    }

    /**
     * Cancel pending signal
     */
    public cancel(): void {
        if (this._status !== SignalStatus.PENDING) {
            throw new DomainError('Can only cancel pending signals');
        }
        this._status = SignalStatus.CANCELLED;
    }

    /**
     * Calculate Risk/Reward ratio
     */
    public calculateRiskReward(): number {
        const risk = Math.abs(this._entry.value - this._targets.stopLoss);
        const primaryTarget = (this._targets.takeProfits[1] || this._targets.takeProfits[0]) as number;
        const reward = Math.abs(primaryTarget - this._entry.value);

        if (risk === 0) return 0;
        return Number((reward / risk).toFixed(2));
    }

    /**
     * Get potential profit percentage for a specific target
     */
    public getPotentialProfit(targetIndex: number = 0): number {
        if (targetIndex >= this._targets.takeProfits.length) {
            throw new DomainError('Target index out of bounds');
        }

        const target = this._targets.takeProfits[targetIndex] as number;
        const entryPrice = this._entry.value;

        if (this._direction === SignalDirection.LONG) {
            return ((target - entryPrice) / entryPrice) * 100;
        } else {
            return ((entryPrice - target) / entryPrice) * 100;
        }
    }

    /**
     * Get potential loss percentage
     */
    public getPotentialLoss(): number {
        const entryPrice = this._entry.value;
        const stopLoss = this._targets.stopLoss;

        if (this._direction === SignalDirection.LONG) {
            return ((entryPrice - stopLoss) / entryPrice) * 100;
        } else {
            return ((stopLoss - entryPrice) / entryPrice) * 100;
        }
    }

    /**
     * Check if signal is active (can be traded)
     */
    public isActive(): boolean {
        return this._status === SignalStatus.PENDING || this._status === SignalStatus.SENT;
    }

    /**
     * Check if signal is completed (executed, failed, or cancelled)
     */
    public isCompleted(): boolean {
        return [SignalStatus.EXECUTED, SignalStatus.FAILED, SignalStatus.CANCELLED]
            .includes(this._status);
    }

    /**
     * Get signal age in minutes
     */
    public getAgeInMinutes(): number {
        const now = new Date();
        return Math.floor((now.getTime() - this._createdAt.getTime()) / (1000 * 60));
    }

    /**
     * Check if signal is expired based on timeframe
     */
    public isExpired(maxAgeMinutes: number = 60): boolean {
        return this.getAgeInMinutes() > maxAgeMinutes;
    }

    /**
     * Get signal strength based on confidence and reasoning count
     */
    public getStrength(): 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG' {
        const score = this._confidence + (this._reasoning.length * 0.5);

        if (score >= 9) return 'VERY_STRONG';
        if (score >= 7) return 'STRONG';
        if (score >= 5) return 'MODERATE';

        return 'WEAK';
    }

    /**
     * Convert to plain object for serialization
     */
    public toPlainObject(): {
        id: string;
        pair: string;
        direction: SignalDirection;
        entry: number;
        entryCurrency: string;
        targets: ISignalTargets;
        confidence: number;
        reasoning: string[];
        exchange: ExchangeType;
        timeframe: string;
        strategy: string;
        status: SignalStatus;
        createdAt: Date;
        sentAt?: Date;
        executedAt?: Date;
        riskReward: number;
        strength: string;
        ageMinutes: number;
    } {
        return {
            id: this.id,
            pair: this.pair,
            direction: this.direction,
            entry: this.entry.value,
            entryCurrency: this.entry.currency,
            targets: this.targets,
            confidence: this.confidence,
            reasoning: [...this.reasoning],
            exchange: this.exchange,
            timeframe: this.timeframe,
            strategy: this.strategy,
            status: this.status,
            createdAt: this.createdAt,
            sentAt: this.sentAt!,
            executedAt: this.executedAt!,
            riskReward: this.calculateRiskReward(),
            strength: this.getStrength(),
            ageMinutes: this.getAgeInMinutes()
        };
    }

    private validateConfidence(): void {
        if (this._confidence < 0 || this._confidence > 10) {
            throw new DomainError('Confidence must be between 0 and 10');
        }
    }

    private validateTargets(): void {
        if (this._targets.takeProfits.length === 0) {
            throw new DomainError('At least one take profit target is required');
        }

        if (this._targets.takeProfits.length > 5) {
            throw new DomainError('Maximum 5 take profit targets allowed');
        }

        const entryPrice = this._entry.value;

        if (this._direction === SignalDirection.LONG) {
            if (this._targets.stopLoss >= entryPrice) {
                throw new DomainError('Stop loss must be below entry price for LONG signals');
            }

            for (const tp of this._targets.takeProfits) {
                if (tp <= entryPrice) {
                    throw new DomainError('Take profit targets must be above entry price for LONG signals');
                }
            }
        } else {
            if (this._targets.stopLoss <= entryPrice) {
                throw new DomainError('Stop loss must be above entry price for SHORT signals');
            }

            for (const tp of this._targets.takeProfits) {
                if (tp >= entryPrice) {
                    throw new DomainError('Take profit targets must be below entry price for SHORT signals');
                }
            }
        }
    }

    private validateReasoning(): void {
        if (this._reasoning.length === 0) {
            throw new DomainError('At least one reasoning must be provided');
        }

        if (this._reasoning.length > 10) {
            throw new DomainError('Maximum 10 reasoning items allowed');
        }

        for (const reason of this._reasoning) {
            if (!reason || reason.trim().length === 0) {
                throw new DomainError('Reasoning cannot be empty');
            }
        }
    }
}
