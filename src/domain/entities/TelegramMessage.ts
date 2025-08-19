import {UserId} from "../valueObjects/telegram/UserId";

export class TelegramMessage {
    constructor(
        private readonly id: number,
        private readonly chatId: number,
        private readonly text: string,
        private readonly userId: UserId,
        private readonly timestamp: Date,
    ) {}

    getId(): number { return this.id; }

    getChatId(): number { return this.chatId; }

    getText(): string { return this.text; }

    getUserId(): UserId { return this.userId; }

    getTimestamp(): Date { return this.timestamp; }

    isCommand(): boolean {
        return this.text.startsWith('/');
    }
}
