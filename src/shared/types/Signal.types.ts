import {ExchangeType} from "./Exchange.types";
import {Price} from "../../domain/valueObjects/Price";
import {UniqueId} from "../../domain/valueObjects/UniqueId";

export interface ISignalMetadata {
    signalId: string;
    pair: string;
    direction: SignalDirection;
    confidence: number;
    exchange: ExchangeType;
    strategy: string;
}

export interface ISignalTargets {
    readonly stopLoss: number;
    readonly takeProfits: readonly number[];
}

export interface ISignalCreateParams {
    id?: UniqueId;
    pair: string;
    direction: SignalDirection;
    entry: Price;
    targets: ISignalTargets;
    confidence: number;
    reasoning: string[];
    exchange: ExchangeType;
    timeframe: string;
    strategy: string;
}

export enum SignalDirection {
    LONG = 'LONG',
    SHORT = 'SHORT'
}

export enum SignalStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    EXECUTED = 'EXECUTED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}
