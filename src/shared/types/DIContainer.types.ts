import {DIContainer} from "../container/DIContainer";

export type ServiceKey = string | symbol;
export type ServiceFactory<T = any> = (container: DIContainer) => T;
export type ServiceInstance<T = any> = T;

export interface ServiceDefinition<T = any> {
    factory: ServiceFactory<T>;
    singleton: boolean;
    instance?: ServiceInstance<T>;
    dependencies?: ServiceKey[];
}
