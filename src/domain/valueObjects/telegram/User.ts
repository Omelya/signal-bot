export class User {
    constructor(
        private readonly id: number,
        private readonly firstname: string,
        private readonly lastname?: string,
        private readonly username?: string,
    ) {
        if (id <= 0) {
            throw new Error('User ID must be positive');
        }
    }

    getId(): number { return this.id; }

    getFirstname(): string { return this.firstname ?? ''; }

    getLastname(): string { return this.lastname ?? ''; }

    getUsername(): string { return this.username ?? ''; }
}
