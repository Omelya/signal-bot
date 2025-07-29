export interface ISerializer<T = any> {
    serialize(data: T): string | Buffer;
    deserialize(data: string | Buffer): T;
}

export interface IJsonSerializer extends ISerializer {
    serialize(data: any): string;
    deserialize(data: string): any;
}
