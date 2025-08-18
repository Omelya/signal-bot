import { ServiceNotFoundError } from '../errors/DomainErrors';
import {ServiceDefinition, ServiceFactory, ServiceInstance, ServiceKey} from '../types';

export class DIContainer {
    private services = new Map<ServiceKey, ServiceDefinition>();
    private resolving = new Set<ServiceKey>();
    private static container: DIContainer;

    public static initialize(): DIContainer {
        if (this.container) {
            return this.container;
        }

        this.container = new DIContainer();

        return this.container;
    }

    /**
     * Register a service factory
     */
    public register<T>(
        key: ServiceKey,
        factory: ServiceFactory<T>,
        options: { singleton?: boolean; dependencies?: ServiceKey[] } = {}
    ): this {
        const { singleton = true, dependencies = [] } = options;

        this.services.set(key, {
            factory,
            singleton,
            dependencies
        });

        return this;
    }

    /**
     * Register a service instance
     */
    public registerInstance<T>(key: ServiceKey, instance: ServiceInstance<T>): this {
        this.services.set(key, {
            factory: () => instance,
            singleton: true,
            instance
        });

        return this;
    }

    /**
     * Register a class constructor
     */
    public registerClass<T>(
        key: ServiceKey,
        constructor: new (...args: any[]) => T,
        options: { singleton?: boolean; dependencies?: ServiceKey[] } = {}
    ): this {
        const { singleton = true, dependencies = [] } = options;

        this.register(
            key,
            (container) => {
                const deps = dependencies.map(dep => container.get(dep));
                return new constructor(...deps);
            },
            { singleton, dependencies }
        );

        return this;
    }

    /**
     * Get a service instance
     */
    public get<T>(key: ServiceKey): T {
        // Check for circular dependencies
        if (this.resolving.has(key)) {
            throw new ServiceNotFoundError(
                `Circular dependency detected while resolving: ${String(key)}`
            );
        }

        const serviceDefinition = this.services.get(key);
        if (!serviceDefinition) {
            throw new ServiceNotFoundError(`Service not found: ${String(key)}`);
        }

        // Return existing singleton instance
        if (serviceDefinition.singleton && serviceDefinition.instance) {
            return serviceDefinition.instance;
        }

        try {
            // Mark as resolving
            this.resolving.add(key);

            // Create new instance
            const instance = serviceDefinition.factory(this);

            // Store singleton instance
            if (serviceDefinition.singleton) {
                serviceDefinition.instance = instance;
            }

            return instance;
        } catch (error) {
            throw new ServiceNotFoundError(
                `Failed to resolve service: ${String(key)}. Error: ${error}`
            );
        } finally {
            // Remove from resolving set
            this.resolving.delete(key);
        }
    }

    /**
     * Check if a service is registered
     */
    public has(key: ServiceKey): boolean {
        return this.services.has(key);
    }

    /**
     * Remove a service registration
     */
    public remove(key: ServiceKey): boolean {
        return this.services.delete(key);
    }

    /**
     * Clear all services
     */
    public clear(): void {
        this.services.clear();
        this.resolving.clear();
    }

    /**
     * Get all registered service keys
     */
    public getKeys(): ServiceKey[] {
        return Array.from(this.services.keys());
    }

    /**
     * Create a child container that inherits from this one
     */
    public createChild(): DIContainer {
        const child = new DIContainer();

        // Copy all service definitions to child
        for (const [key, definition] of this.services) {
            child.services.set(key, { ...definition });
        }

        return child;
    }

    /**
     * Resolve dependencies for a given service
     */
    public resolveDependencies(key: ServiceKey): any[] {
        const serviceDefinition = this.services.get(key);
        if (!serviceDefinition || !serviceDefinition.dependencies) {
            return [];
        }

        return serviceDefinition.dependencies.map(dep => this.get(dep));
    }

    /**
     * Get service dependency graph
     */
    public getDependencyGraph(): Map<ServiceKey, ServiceKey[]> {
        const graph = new Map<ServiceKey, ServiceKey[]>();

        for (const [key, definition] of this.services) {
            graph.set(key, definition.dependencies || []);
        }

        return graph;
    }

    /**
     * Validate that all dependencies can be resolved
     */
    public validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const [key, definition] of this.services) {
            if (definition.dependencies) {
                for (const dependency of definition.dependencies) {
                    if (!this.has(dependency)) {
                        errors.push(
                            `Service '${String(key)}' depends on '${String(dependency)}' which is not registered`
                        );
                    }
                }
            }
        }

        // Check for circular dependencies
        const circularDeps = this.detectCircularDependencies();
        if (circularDeps.length > 0) {
            errors.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Detect circular dependencies
     */
    private detectCircularDependencies(): string[] {
        const visited = new Set<ServiceKey>();
        const recursionStack = new Set<ServiceKey>();
        const cycles: string[] = [];

        const dfs = (key: ServiceKey, path: ServiceKey[]): void => {
            if (recursionStack.has(key)) {
                const cycleStart = path.indexOf(key);
                const cycle = path.slice(cycleStart).concat(key);
                cycles.push(cycle.map(k => String(k)).join(' -> '));
                return;
            }

            if (visited.has(key)) {
                return;
            }

            visited.add(key);
            recursionStack.add(key);

            const serviceDefinition = this.services.get(key);
            if (serviceDefinition && serviceDefinition.dependencies) {
                for (const dependency of serviceDefinition.dependencies) {
                    dfs(dependency, [...path, key]);
                }
            }

            recursionStack.delete(key);
        };

        for (const key of this.services.keys()) {
            if (!visited.has(key)) {
                dfs(key, []);
            }
        }

        return cycles;
    }

    /**
     * Create a service scope that automatically disposes resources
     */
    public createScope(): ServiceScope {
        return new ServiceScope(this);
    }

    /**
     * Get container statistics
     */
    public getStats(): {
        totalServices: number;
        singletonServices: number;
        transientServices: number;
        instantiatedSingletons: number;
    } {
        let singletonCount = 0;
        let transientCount = 0;
        let instantiatedCount = 0;

        for (const definition of this.services.values()) {
            if (definition.singleton) {
                singletonCount++;
                if (definition.instance) {
                    instantiatedCount++;
                }
            } else {
                transientCount++;
            }
        }

        return {
            totalServices: this.services.size,
            singletonServices: singletonCount,
            transientServices: transientCount,
            instantiatedSingletons: instantiatedCount
        };
    }
}

/**
 * Service scope for managing disposable resources
 */
export class ServiceScope {
    private disposables: Array<() => void | Promise<void>> = [];

    constructor(private container: DIContainer) {}

    /**
     * Get a service within this scope
     */
    public get<T>(key: ServiceKey): T {
        return this.container.get<T>(key);
    }

    /**
     * Register a disposal callback
     */
    public onDispose(callback: () => void | Promise<void>): void {
        this.disposables.push(callback);
    }

    /**
     * Dispose all resources in this scope
     */
    public async dispose(): Promise<void> {
        const promises = this.disposables.map(callback => {
            try {
                return callback();
            } catch (error) {
                console.error('Error during disposal:', error);
                return Promise.resolve();
            }
        });

        await Promise.all(promises);
        this.disposables.length = 0;
    }
}
