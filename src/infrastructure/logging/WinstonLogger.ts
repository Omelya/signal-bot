import winston from 'winston';
import { ILogger } from '../../shared';

export interface IWinstonLoggerConfig {
    level: string;
    file: string;
    maxSize: string;
    maxFiles: number;
    console?: boolean;
}

export class WinstonLogger implements ILogger {
    private logger: winston.Logger;

    constructor(config: IWinstonLoggerConfig) {
        this.logger = this.createLogger(config);
    }

    error(message: string, meta?: any): void {
        this.logger.error(message, meta);
    }

    warn(message: string, meta?: any): void {
        this.logger.warn(message, meta);
    }

    info(message: string, meta?: any): void {
        this.logger.info(message, meta);
    }

    debug(message: string, meta?: any): void {
        this.logger.debug(message, meta);
    }

    // Winston-specific methods
    public getWinstonLogger(): winston.Logger {
        return this.logger;
    }

    public addTransport(transport: winston.transport): void {
        this.logger.add(transport);
    }

    public removeTransport(transport: winston.transport): void {
        this.logger.remove(transport);
    }

    private createLogger(config: IWinstonLoggerConfig): winston.Logger {
        const transports: winston.transport[] = [];

        // File transport with rotation
        transports.push(
            new winston.transports.File({
                filename: config.file,
                level: config.level,
                maxsize: this.parseSize(config.maxSize),
                maxFiles: config.maxFiles,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true }),
                    winston.format.json()
                )
            })
        );

        // Console transport (enabled by default in development)
        if (config.console !== false && process.env.NODE_ENV !== 'production') {
            transports.push(
                new winston.transports.Console({
                    level: config.level,
                    format: winston.format.combine(
                        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                        winston.format.errors({ stack: true }),
                        winston.format.colorize(),
                        winston.format.printf(({ level, message, timestamp, ...meta }) => {
                            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
                            return `${timestamp} [${level}]: ${message}${metaStr}`;
                        })
                    )
                })
            );
        }

        return winston.createLogger({
            level: config.level,
            transports,
            exitOnError: false,
            // Handle uncaught exceptions and rejections
            exceptionHandlers: [
                new winston.transports.File({
                    filename: config.file.replace('.log', '-exceptions.log'),
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.errors({ stack: true }),
                        winston.format.json()
                    )
                })
            ],
            rejectionHandlers: [
                new winston.transports.File({
                    filename: config.file.replace('.log', '-rejections.log'),
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.errors({ stack: true }),
                        winston.format.json()
                    )
                })
            ]
        });
    }

    private parseSize(sizeStr: string): number {
        const size = parseInt(sizeStr);
        const unit = sizeStr.toLowerCase().slice(-2);

        switch (unit) {
            case 'kb':
                return size * 1024;
            case 'mb':
                return size * 1024 * 1024;
            case 'gb':
                return size * 1024 * 1024 * 1024;
            default:
                return size;
        }
    }
}
