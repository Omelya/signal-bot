import {AppConfig, IEventBus, ILogger} from "../../shared";
import TelegramBot from "node-telegram-bot-api";
import {TelegramMessage} from "../../domain/entities/TelegramMessage";
import {User} from "../../domain/valueObjects/telegram/User";
import {TelegramCommandHandler} from "./TelegramCommandHandler";
import {TelegramCallbackHandler} from "./TelegramCallbackHandler";
import {TelegramCallbackDataEnum} from "../../shared/types/TelegramCallbackData.types";

export class TelegramBotController {
    private bot?: TelegramBot;

    private attempt: number = 0;

    private maxAttempts: number = 5;

    private isRunning: boolean = false;

    public constructor(
        private telegramCommandHandler: TelegramCommandHandler,
        private telegramCallbackHandler: TelegramCallbackHandler,
        private appConfig: AppConfig,
        private readonly eventBus: IEventBus,
        private readonly logger: ILogger,
    ) {
        this.init(
            this.appConfig.telegram.botToken,
            this.appConfig.telegram.polling,
        );
    }

    public run() {
        if (!this.bot || this.isRunning) {
            this.logger.warn('Bot is not initialized or already running');
            return;
        }

        try {
            this.setupCommandHandlers(this.bot);
            this.setupCallbackHandlers(this.bot)

            this.isRunning = true;
            this.logger.info('Telegram bot started successfully');
        } catch (error: any) {
            this.logger.error(`Failed to start bot listeners: ${error.message}`);
        }
    }

    public async stop() {
        if (!this.bot || !this.isRunning) {
            return;
        }

        try {
            this.bot.clearTextListeners();

            await new Promise(resolve => setTimeout(resolve, 1000));

            await this.bot.stopPolling();
            await this.bot.close();

            this.isRunning = false;
            this.logger.info('Telegram bot stopped successfully');
        } catch (error: any) {
            if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                this.logger.warn('Rate limit during stop - bot stopped anyway');
                this.isRunning = false;
                return;
            }

            this.logger.error(`Error stopping bot: ${error.message}`);
        }
    }

    private setupCommandHandlers(bot: TelegramBot) {
        bot.onText(/\/start/, async (msg) => {
            const message = this.createMessage(msg);

            try {
                await this.telegramCommandHandler.start(message);
            } catch (error: any) {
                this.logger.error(`Starting telegram bot error: ${error.message}`, msg);
            }
        });

        bot.on('polling_error', (error) => {
           this.logger.error('Polling error:', error);
        });

        bot.on('error', (error) => {
            this.logger.error('Bot error:', error);
        });
    }

    private setupCallbackHandlers(bot: TelegramBot) {
        bot.on('callback_query', async (callbackQuery) => {
            const message = callbackQuery.message;
            const data = callbackQuery.data;

            if (!message || !data) return;

            try {
                const telegramMessage = this.createMessage(message);

                await bot.answerCallbackQuery(callbackQuery.id);

                switch (data) {
                    case TelegramCallbackDataEnum.MAIN_MENU:
                        await this.telegramCallbackHandler.sendMainMenu(telegramMessage);
                        break;
                    case TelegramCallbackDataEnum.SETTINGS_NEW_USER:
                        await this.telegramCallbackHandler.settingsNewUser(telegramMessage);
                        break;
                    case TelegramCallbackDataEnum.SETTINGS:
                        await this.telegramCallbackHandler.settings(telegramMessage);
                        break;
                    case TelegramCallbackDataEnum.ADD_TRADING_PAIR:
                        await this.telegramCallbackHandler.addTradingPair(telegramMessage);
                        break;
                    case TelegramCallbackDataEnum.CHANGE_SIGNAL_NOTIFICATION:
                        await this.telegramCallbackHandler.changeStatusNotification(telegramMessage);
                        break;
                }

                if (data.startsWith(TelegramCallbackDataEnum.DELETE_TRADING_PAIR)) {
                    const pair = data.slice(TelegramCallbackDataEnum.DELETE_TRADING_PAIR.length);

                    await this.telegramCallbackHandler.deleteTradingPair(telegramMessage, pair);
                    return;
                }

                if (data.startsWith(TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR)) {
                    const pair = data.slice(TelegramCallbackDataEnum.CHOOSE_TRADING_PAIR.length);

                    await this.telegramCallbackHandler.chooseTradingPair(telegramMessage, pair);
                    return;
                }
            } catch (error: any) {
                this.logger.error('Failed to start callback query', error);
            }
        });
    }

    private createMessage(telegramMessage: TelegramBot.Message): TelegramMessage {
        if (!telegramMessage.from?.id) {
            throw new Error('Message must have a valid user ID');
        }

        const user = new User(
            telegramMessage.from.id,
            telegramMessage.from.first_name,
            telegramMessage.from.last_name,
            telegramMessage.from.username,
        );

        return new TelegramMessage(
            telegramMessage.message_id,
            telegramMessage.chat.id,
            telegramMessage.text ?? '',
            user,
            new Date(telegramMessage.date),
        );
    }

    private async init(botToken: string, polling: boolean) {
        try {
            this.attempt++
            this.logger.info(`Telegram bot connection, attempt ${this.attempt}`);

            this.bot = new TelegramBot(
                botToken,
                {
                    polling: polling,
                    request: {
                        url: '',
                        agentOptions: {
                            keepAlive: true,
                            family: 4
                        }
                    }
                },
            );

            const me = await this.bot.getMe();

            this.telegramCommandHandler.init(this.bot)
            this.telegramCallbackHandler.init(this.bot);

            this.logger.info(`Bot connected successfully: @${me.username}`);
        } catch (error: any) {
            this.logger.error(`Init Telegram bot attempt ${this.attempt}:`, error);

            if (this.attempt <= this.maxAttempts) {
                setTimeout(() => this.init(botToken, polling), this.getDelay());
            } else {
                this.logger.error(`Failed to initialize bot after ${this.maxAttempts} attempts`);
                throw new Error(`Telegram bot initialization failed: ${error.message}`);
            }
        }
    }

    private getDelay() {
        return this.attempt * 500;
    }
}
