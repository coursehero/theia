import { AsyncParallelHook } from 'tapable'

type IAsyncParallelHook = any

class TypedAsyncParallelHook<Args extends object> implements Tapable.ITypedAsyncParallelHook<Args> {
  private _hook: IAsyncParallelHook
  private _mapIn: (args: Args) => any[]
  private _mapOut: (argsArr: any[]) => Args

  constructor (args: (keyof Args)[]) {
    this._hook = new AsyncParallelHook(args)

    // map args from object to array
    this._mapIn = new Function('a', '"use strict";\n' +
      'return [' + args.map(key => 'a.' + key).join(',') +
      ']') as any

    // map args from array to object
    this._mapOut = new Function('a', '"use strict";\n' +
      'return {' + args.map((key, idx) => `${key}: a[${idx}]`).join(',') +
      '}') as any
  }

  promise (args: Args) {
    return this._hook.promise(...this._mapIn(args))
  }

  tapPromise (name: string, listener: (args: Args) => void) {
    return this._hook.tapPromise({ name }, (...args: any[]) => listener(this._mapOut(args)))
  }
}

export { TypedAsyncParallelHook }
