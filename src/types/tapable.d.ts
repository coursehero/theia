// punt
declare module 'tapable'

declare namespace Tapable {
  interface SyncHook {
    call(core: Theia.Core, arg1?: any, arg2?: any, arg3?: any): void
    tap(name: string, fn: (core: Theia.Core, arg1?: any, arg2?: any, arg3?: any) => void): void
  }

  interface AsyncParallelHook {
    promise(core: Theia.Core, arg1?: any, arg2?: any, arg3?: any): Promise<void>
    tapPromise(name: string, fn: (core: Theia.Core, arg1?: any, arg2?: any, arg3?: any) => Promise<void>): void
  }
}
