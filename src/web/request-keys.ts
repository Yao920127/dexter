import { AsyncLocalStorage } from 'node:async_hooks';

interface KeyScope {
  values: Readonly<Record<string, string>>;
}

const scopes = new AsyncLocalStorage<KeyScope>();
let managed: ReadonlySet<string> = new Set();
let hideServerValues = false;

/** Runs `fn` with these environment values visible only to code it starts (the whole async chain). */
export function withRequestKeys<T>(values: Readonly<Record<string, string>>, fn: () => T): T {
  return scopes.run({ values: { ...values } }, fn);
}

/**
 * Makes the managed variable names resolve per request. With `hideServerValues`, the server's own
 * environment is never used for them, so a deployed instance cannot spend its owner's keys.
 */
export function installRequestEnv(names: readonly string[], hideServer: boolean): void {
  managed = new Set(names);
  hideServerValues = hideServer;
  const real = process.env;
  process.env = new Proxy(real, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && managed.has(prop)) {
        const scoped = scopes.getStore()?.values[prop];
        if (scoped !== undefined) return scoped;
        if (hideServerValues) return undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (typeof prop === 'string' && managed.has(prop)) {
        if (scopes.getStore()?.values[prop] !== undefined) return true;
        if (hideServerValues) return false;
      }
      return Reflect.has(target, prop);
    },
  });
}
