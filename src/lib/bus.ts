type Handler<T = void> = (data: T) => void;

const listeners = new Map<string, Set<Handler<any>>>();

export function on<T = void>(event: string, fn: Handler<T>): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return () => {
        listeners.get(event)?.delete(fn);
    };
}

export function emit<T = void>(event: string, data?: T) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(data);
}
