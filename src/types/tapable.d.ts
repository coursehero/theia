// punt
declare module 'tapable'

declare namespace Tapable {
  interface SyncHook {
    call: any
    tap: any
  }
}
