/**
 * Promise 
 * AEPKILL @ 2016-10-6 14:21:21
 */

/**
 * Promise Inside State
 * 
 * 虽然说只有3个状态，但是其实有 4 个状态
 * ERROR 状态的时候会响应 catch & reject
 * 
 * @enum {number}
 */
enum PromiseState {
    PENDING,
    RESOLVED,
    REJECTED,
    ERROR
};

declare global {
    const process: {
        nextTick?: (fn: Function, ...args: any[]) => void
    };
}


interface IOnDone<T> {
    <U>(data?: T): Promise<T> | Promise<U>;
    (data?: T): any;
};
interface IOnError {
    (err: Error): void;
};
interface IPromiseChildren<T> {
    promise: Promise<T>;
    resolve: (data: T) => void;
    reject: (data: any) => void;
};



export class Promise<T> {
    private _currentState: PromiseState = PromiseState.PENDING;
    private _value: T | any = null;
    private _fulfillListeners: Array<IOnDone<T>> = [];
    private _rejectListeners: Array<IOnDone<T>> = [];
    private _errorListeners: Array<IOnError> = [];
    private _childrens: Array<IPromiseChildren<T>> = [];
    private _loop = false;

    public constructor(provider: (resolve: (data: T) => void, reject: (data: T | any) => void) => void) {
        if (!(this instanceof Promise)) {
            return new Promise<T>(provider);
        }
        if (isFunction(provider)) {
            try {
                provider(this._emitResolve.bind(this), this._emitReject.bind(this));
            } catch (err) {
                this._emitError(err);
            }
        } else {
            throw new TypeError('Promise resolver  is not a function');
        }
    }
    public then(onFulfilled: IOnDone<T>, onRejected: IOnDone<T>) {
        // onFulfilled & onRejected 不为函数时仅忽略不抛出错误
        if (isFunction(onFulfilled)) {
            this._fulfillListeners.push(onFulfilled);
        }
        if (isFunction(onRejected)) {
            this._rejectListeners.push(onRejected);
        }

        // Promise 已经稳定则直接触发回调循环
        // WARING: 标准要求使用将 Promise 的回调加入 microtask 任务队列执行，但是浏览器端没提供响应API
        if (this._currentState !== PromiseState.PENDING) {
            this._emitCallAlls();
        }
        return this._addChildren();
    }
    public reject(onRejected: IOnDone<T>) {
        return this.then(undefined, onRejected);
    }
    public catch(onError: IOnError) {
        if (isFunction(onError)) {
            this._errorListeners.push(onError);
        }
        return this._addChildren();
    }

    private _addChildren(): Promise<T> {
        let temp = Promise.deferred<T>();
        this._childrens.push(temp);
        return temp.promise;
    }
    private _emitResolve(value: T) {
        if (this._currentState === PromiseState.PENDING) {
            this._value = value;
            this._currentState = PromiseState.RESOLVED;
            this._emitCallAlls();
        }
    }
    private _emitReject(reason: any) {
        if (this._currentState === PromiseState.PENDING) {
            this._value = reason;
            this._currentState = PromiseState.REJECTED;
            this._emitCallAlls();
        }
    }
    private _emitError(err: Error) {
        if (this._currentState === PromiseState.PENDING) {
            this._value = err;
            this._currentState = PromiseState.ERROR;
            this._emitCallAlls();
        }
    }
    private _emitCallAlls() {
        if (!this._loop) {
            this._loop = true;
            nextTick(() => {
                this._callAlls();
                this._loop = false;
            });
        }
    }
    private _callAlls() {
        
    }


    public static deferred<T>(): IPromiseChildren<T> {
        let resolve: (data: T) => void,
            reject: (data: any) => void,
            promise = new Promise<T>((_resolve, _reject) => {
                resolve = _resolve;
                reject = _reject;
            });
        return {
            resolve,
            reject,
            promise
        };
    }
    public static all() {

    }
    public static race() {

    }
}

/**
 * 确定一个值是否是函数类型
 * 
 * @param {Function} fn
 * @returns {boolean}
 */
function isFunction(fn: Function): boolean {
    return typeof fn === 'function';
}

/**
 * 在下个时间片执行函数
 * 
 * WARING: 此处不完全符合规范 ，Promise A+ 规范要求 Promise 需要执行在 MicroTask 任务队列
 * 但是浏览器端并没有相应API，只能用 setTimeout 代替
 * 
 * @param {Function} fn
 */
const nextTick = (function () {
    let result: (fn: Function, ...args: any[]) => void = null;
    if (process && typeof process.nextTick === 'function') {
        return result = process.nextTick;
    } else {
        return result = function (fn: Function, ...args: any[]) {
            setTimeout(fn, 0, ...args);
        }
    }
})();
