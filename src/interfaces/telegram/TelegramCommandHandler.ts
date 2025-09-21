import {TelegramMessage} from "../../domain/entities/TelegramMessage";
import {TelegramCallbackDataEnum} from "../../shared/types/TelegramCallbackData.types";
import {AbstractTelegramHandler} from "./AbstractTelegramHandler";
import {User} from "../../domain/entities/User";

export class TelegramCommandHandler extends AbstractTelegramHandler {
    public async start(message: TelegramMessage) {
        let user = await this
            .userRepository
            .findByTelegramId(message.getUser().getId());

        if (!user) {
            const newUser = User.create({
                id: 0,
                telegram_user_id: message.getUser().getId(),
                telegram_username: message.getUser().getUsername(),
                notifications_enabled: false,
            });

            await this.userRepository.save(newUser)
            await this.showMainMenuForNewUser(message);
            return;
        }

        const mainMenu = await this.showMainMenu(message);

        if (mainMenu) {
            await this.sendMessage(
                message.getChatId(),
                mainMenu?.text,
                mainMenu.button,
            );
        }
    }

    private generateWelcomeMessage(username: string) {
        return `👋 Ласкаво просимо, ${username}, до CryptoSignals!

🎯 Цей бот надсилає сигнали для торгівлі криптовалютами на основі технічного аналізу.

📋 Для початку роботи:
1️⃣ Оберіть валютні пари
2️⃣ Налаштуйте сповіщення  
3️⃣ Отримуйте сигнали!`;
    }

    private async showMainMenuForNewUser(message: TelegramMessage) {
        const text = this.generateWelcomeMessage(message.getUser().getUsername());
        const options = {
            reply_markup: {
                inline_keyboard: [[{
                    text: '🚀 Розпочати налаштування',
                    callback_data: TelegramCallbackDataEnum.SETTINGS_NEW_USER,
                }]],
            },
        };

        await this.bot?.sendMessage(message.getChatId(), text, options);
    }
}
