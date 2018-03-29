// tried using a typed array for varargs:
// interface SyncHook<VarArgs extends any[]> {
//   call(core: Theia.Core, ...args: VarArgs): void
//   tap(name: string, fn: (core: Theia.Core, ...args: VarArgs[]) => void): void
// }
// didn't work. see:
// https://github.com/Microsoft/TypeScript/issues/1024

// attempt at adding typings: https://github.com/webpack/tapable/issues/43
// this creates a interface change (sending objects instead of list of params)
// so this can be implemented with a small wrapper around tapable

declare module 'tapable'

declare namespace Tapable {
  class ITypedAsyncParallelHook<Args extends object> {
    constructor(args: (keyof Args)[])

    promise(args: Args): Promise<void>

    tapPromise(name: string, listener: (args: Args) => void): any
  }
}
