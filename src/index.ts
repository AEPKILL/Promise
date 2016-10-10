/**
 * PROMISE 
 * 
 * a@aepkill.com
 */

enum PromiseState {
    PENDING,
    RESOLVED,
    REJECTED
};

export interface IResolveCallback<T> {
    (data: T): Promise<T> | any;
};
export interface IRejectCallback<T> {
    (data: T | any): Promise<T> | any;
};
export interface IExceptionCallback {
    (data: Error): void;
};
export interface IChildrenPromise<T> {
    promise: Promise<T>;
    resolve: IResolveCallback<T>;
    reject: IRejectCallback<T>;
    exception: IExceptionCallback;
};
export interface IProvider<T> {
    (resolve: IResolveCallback<T>, reject: IRejectCallback<T>): void;
}
declare const process: {
    nextTick: (fn: (...args: any[]) => void, ...args: any[]) => void;
};



export class Promise<T> {
    /**
     * Promise 的当前状态
     * 
     * @private
     * 
     * @memberOf Promise
     */
    private _currentState = PromiseState.PENDING;
    /**
     * Promise 状态稳定时候的值
     * 
     * @private
     * @type {*}
     * @memberOf Promise
     */
    private _value: any = null;
    /**
     * Promise 状态为 RESOLVED 时是否是由异常引起的
     * 
     * @private
     * 
     * @memberOf Promise
     */
    private _exception = false;
    /**
     * Promise 是否已经准备好在下个时间片处理相关事务(触发 ResolveCallback & RejectCallback & ExceptionCallback & NextPromise)
     * 
     * @private
     * 
     * @memberOf Promise
     */
    private _loop = false;
    /**
     * 通过 then | catch | reject 方法派生的所有子 Promise
     * IChildrenPromise 包含子 Promise 和生成子 Promise 时设置的 ResolveCallback 或 RejectCallback 或 ExceptionCallback
     *   
     * 
     * @private
     * @type {Array<IChildrenPromise<any>>}
     * @memberOf Promise
     */
    private _childrenPromises: Array<IChildrenPromise<any>> = [];



    public constructor(provider: IProvider<T>) {
        if (isFunction(provider)) {
            try {
                provider(this._emitResolve.bind(this), this._emitReject.bind(this));
            } catch (err) {
                this._emitError(err);
            }
        } else {
            throw new TypeError(`Promise resolver ${provider} is not a function`);
        }
    }
    public then(resolve?: IResolveCallback<T>, reject?: IRejectCallback<T>) {
        return this._then(resolve, reject);
    }
    public reject(reject?: IRejectCallback<T>) {
        return this._then(undefined, reject);
    }
    public catch(exception?: IExceptionCallback) {
        return this._then(undefined, undefined, exception);
    }



    /**
     * 注册 ResolveCallback & RejectCallback & ExceptionCallback 并返回 子Promise
     * 
     * @private
     * @template U
     * @param {IResolveCallback<T>} [resolve]
     * @param {IRejectCallback<T>} [reject]
     * @param {IExceptionCallback} [exception]
     * @returns {Promise<U>}
     * 
     * @memberOf Promise
     */
    private _then<U>(resolve?: IResolveCallback<T>, reject?: IRejectCallback<T>, exception?: IExceptionCallback): Promise<U> {
        let deferred = Promise.Deferred<U>();
        this._childrenPromises.push({
            resolve: resolve,
            reject: reject,
            exception: exception,
            promise: deferred.promise
        });
        // 如果状态稳定，需要主动触发 nextTickCallAlls
        if (!this._canChange()) {
            this._nextTickCallAlls();
        }
        return deferred.promise;
    }
    /**
     * 将Promise状态设置为 RESOLVED
     * 
     * @private
     * @param {T} data
     * 
     * @memberOf Promise
     */
    private _emitResolve(data: T) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.RESOLVED;
        }
        this._nextTickCallAlls();
    }
    /**
     * 将Promise状态设置为 REJECTED
     * 
     * @private
     * @param {*} data
     * 
     * @memberOf Promise
     */
    private _emitReject(data: any) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.REJECTED;
        }
        this._nextTickCallAlls();
    }
    /**
     * 将Promise状态设置为 REJECTED ， 并声明是由异常导致
     * 三种情况:
     *  1. provider 执行异常
     *  2. 父 Promise 的异常没被处理传了过来
     *  3. ResolveCallback 返回一个 thenable，执行这个thenable时发生异常(获取then方法时，或者执行then方法时)
     * 
     * @private
     * @param {Error} err
     * 
     * @memberOf Promise
     */
    private _emitError(err: Error) {
        if (this._canChange()) {
            this._exception = true;
            this._emitReject(err);
        }
        this._nextTickCallAlls();
    }
    /**
     * 执行所有的 子Promise & ResolveCallback & RejectCallback & ExceptionCallback & NextPromise
     * 
     * @private
     * 
     * @memberOf Promise
     */
    private _callAlls() {
        let children: IChildrenPromise<any> = null, result: any = null, call: (data: any) => any;
        while (this._childrenPromises.length) {
            children = this._childrenPromises.shift();
            call = null;
            if (this._currentState === PromiseState.RESOLVED) {
                call = children.resolve;
            } else if (this._currentState === PromiseState.REJECTED) {
                if (this._exception && children.exception) {
                    call = children.exception;
                } else {
                    call = children.reject;
                }
            }
            if (isFunction(call)) {
                try {
                    result = call.call(undefined, this._value);
                    Promise._Resolve(children.promise, result);
                } catch (err) {
                    children.promise._emitError(err);
                }
            } else {
                if (this._currentState === PromiseState.RESOLVED) {
                    children.promise._emitResolve(this._value);
                } else if (this._exception) {
                    children.promise._emitError(this._value);
                } else {
                    children.promise._emitReject(this._value);
                }
            }
        }
    }
    private _nextTickCallAlls() {
        if (!this._loop && this._childrenPromises.length) {
            this._loop = true;
            nextTick(() => {
                this._callAlls();
                this._loop = false;
            });
        }
    }
    /**
     * 状态是否可以被改变
     * 
     * @private
     * @returns
     * 
     * @memberOf Promise
     */
    private _canChange() {
        return this._currentState === PromiseState.PENDING;
    }



    public static All<T>(promises: Array<T | Promise<T>>) {
        let result: Array<T> = [], count = 0, deferred = Promise.Deferred<Array<T>>();
        function check() {
            if (count === promises.length) {
                deferred.resolve(result);
            }
        }
        promises.forEach((value, index) => {
            if (value instanceof Promise) {
                value.then(value => {
                    result[index] = value;
                    count++;
                    check();
                });
            } else {
                result[index] = value;
                count++;
                check();
            }
        });
        return deferred.promise;
    }
    public static Race<T>(promises: Array<T | Promise<T>>) {
        let deferred = Promise.Deferred<T>(), temp: T | Promise<T> = null;
        for (let i = 0; i < promises.length; i++) {
            temp = promises[i];
            if (temp instanceof Promise) {
                temp.then(value => {
                    deferred.resolve(value);
                })
            } else {
                deferred.resolve(temp);
                break;
            }
        }
        return deferred.promise;
    }
    public static Deferred<T>() {
        let resolve: IResolveCallback<T>,
            reject: IRejectCallback<T>,
            promise = new Promise<T>((_resolve, _reject) => {
                resolve = _resolve;
                reject = _reject;
            });
        return {
            promise,
            resolve,
            reject
        };
    }


    /**
     * 如果 ResolveCallback & RejectCallback & ExceptionCallback 返回一个值 x ， 则根据 x 触发子 Promise
     * 
     * @private
     * @static
     * @template T
     * @param {Promise<T>} promise
     * @param {Promise<T>} x
     * 
     * @memberOf Promise
     */
    private static _Resolve<T>(promise: Promise<T>, x: Promise<T>) {
        let called = false, xFn: any = null;
        if (promise === x) {
            throw new TypeError('promise === x');
        }
        try {
            if ((typeof x === 'object' || typeof x === 'function') && isFunction(xFn = x.then)) {
                try {
                    xFn.call(x, function (y: any) {
                        if (!called) {
                            called = true;
                            Promise._Resolve<T>(promise, y);
                        }
                    }, function (y: any) {
                        if (!called) {
                            called = true;
                            promise._emitReject(y);
                        }
                    });
                } catch (err) {
                    if (!called) {
                        promise._emitError(err);
                    }
                }
            } else {
                promise._emitResolve(x as any);
            }
        } catch (err) {
            promise._emitError(err);
        }
    }
}

/**
 * 下个时间片执行，Node.js端使用 nextTick ， 浏览器端使用 setTimeout 代替
 */
const nextTick: typeof process.nextTick = (function () {
    if (typeof process !== 'undefined' &&
        process == null &&
        isFunction(process.nextTick)) {
        return process.nextTick;
    } else {
        return function (fn: Function, ...args: any[]) {
            setTimeout(fn, 0, ...args);
        }
    }
})();

/**
 * 判断一个值是否为函数
 * 
 * @param {*} fn
 * @returns
 */
function isFunction(fn: any) {
    return typeof fn === 'function';
}
