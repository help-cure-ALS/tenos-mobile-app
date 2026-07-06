// src/services/events.ts
export { on, emit } from "@/src/lib/bus";

// type Handler<T = any> = (payload?: T) => void;
//
// const map = new Map<string, Set<Handler>>();
//
// export function emit<T = any>(name: string, payload?: T) {
//     const set = map.get(name);
//     if (!set) return;
//     for (const fn of Array.from(set)) {
//         try { fn(payload); } catch {}
//     }
// }
//
// export function on<T = any>(name: string, fn: Handler<T>) {
//     let set = map.get(name);
//     if (!set) {
//         set = new Set();
//         map.set(name, set);
//     }
//     set.add(fn as Handler);
//     return () => {
//         const s = map.get(name);
//         if (!s) return;
//         s.delete(fn as Handler);
//     };
// }
