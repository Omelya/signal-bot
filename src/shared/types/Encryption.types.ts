export interface IEncryptionResult {
    encrypted: string;
    iv: string;
    tag?: string;
}

export interface IEncryption {
    encrypt(data: string): Promise<IEncryptionResult>;
    decrypt(encrypted: IEncryptionResult): Promise<string>;
    hash(data: string): Promise<string>;
    compare(data: string, hash: string): Promise<boolean>;
    generateKey(): Promise<string>;
    generateSalt(): Promise<string>;
}
