export class ObjectPool<T> {

    private pool: Array<T> = []
    private factory: () => T

    constructor(factory: () => T) {
        this.factory = factory
    }

    public get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()
        } else {
            return this.factory()
        }
    }

    public put(obj: T) {
        this.pool.push(obj)
    }

    public size() {
        return this.pool.length
    }

    public clear() {
        this.pool = []
    }
}