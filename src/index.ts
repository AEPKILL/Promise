enum PromiseState {
    PENDING,
    RESOLVED,
    REJECTED
};

interface IResolveCallback<T> {
    (data: T): Promise<T> | any;
};
interface IRejectCallback<T> {
    (data: T | any): Promise<T> | any;
};
interface IExceptionCallback {
    (data: Error): void;
};
interface IChildrenPromise<T> {
    promise: Promise<T>;
    resolve: IResolveCallback<T>;
    reject: IRejectCallback<T>;
    exception: IExceptionCallback;
};
interface IProvider<T> {
    (resolve: IResolveCallback<T>, reject: IRejectCallback<T>): void;
}
declare const process: {
    nextTick: (fn: (...args: any[]) => void, ...args: any[]) => void;
};
export class Promise<T> {
    // 当前 Promise 状态
    private _currentState = PromiseState.PENDING;
    // 当前 Promise Fulfilled 时的值
    private _value: any = null;
    // 是否是因为异常导致的 REJECTED
    private _exception = false;
    // 是否下个时间片会触发所有回调
    private _loop = false;
    // 本 Promise 派生出的子 Promise
    private _childrenPromises: Array<IChildrenPromise<any>> = [];




    public constructor(provider: IProvider<T>) {
        if (isFunction(provider)) {
            try {
                provider(this._emitResolve.bind(this), this._emitReject.bind(this));
            } catch (err) {
                // 如果数据提供者内部发生异常则触发异常
                this._emitError(err);
            }
        } else {
            throw new TypeError(`Promise resolver ${provider} is not a function`);
        }
    }
    public then<U>(resolve?: IResolveCallback<T>, reject?: IRejectCallback<T>, exception?: IExceptionCallback): Promise<U> {
        let deferred = Promise.Deferred<U>();
        /**
         * 保存本Promise派生的Promise 和 中间件
         * 
         * resolve , reject , exception 执行成功，失败，异常的中间件函数
         * 状态改变时先根据状态改变中间件状态，再根据中间件返回的值触发子Promise
         * 
         *  */
        this._childrenPromises.push({
            resolve: resolve,
            reject: reject,
            exception: exception,
            promise: deferred.promise
        });
        // 状态稳定需要在主动在下个时间片触发所有子Promise
        if (!this._canChange()) {
            this._nextTickCallAlls();
        }
        return deferred.promise;
    }
    public reject(reject?: IRejectCallback<T>) {
        return this.then(undefined, reject);
    }
    public catch(exception?: IExceptionCallback) {
        return this.then(undefined, undefined, exception);
    }


    /**
     * 私有函数: 使状态切换到 RESOLVED 并设置数据
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
     * 私有函数: 使状态切换到 REJECTED 并设置数据
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
     * 私有函数: 使状态切换到 REJECTED 并设置数据并设置是由数据提供者发生异常导致的
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
     * 状态改变时触发所有子 Promise
     * 
     * @private
     * 
     * @memberOf Promise
     */
    private _callAlls() {
        let children: IChildrenPromise<any> = null, result: any = null, call: (data: any) => any;
        while (this._childrenPromises.length) {
            children = this._childrenPromises.shift();


            // call 为中间件，一个Promise仅会被生效一个中间件

            if (this._currentState === PromiseState.RESOLVED) {
                call = children.resolve;
            } else if (this._currentState === PromiseState.REJECTED) {
                if (this._exception && children.exception) {
                    call = children.exception;
                } else {
                    call = children.reject;
                }
            }

            // 如果中间件为一个函数
            if (isFunction(call)) {
                try {
                    // 将中间件返回的值通过 _Resolve 应用于子 Promise
                    result = call.call(undefined, this._value);
                    Promise._Resolve(children.promise, result);
                } catch (err) {
                    // 中间件执行过程中发生异常则根据异常触发子Promise异常
                    children.promise._emitError(err);
                }

                // 否则根据当前状态触发子Promise
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
    /**
     * 下个时间片触发所有子Promise
     * 
     * @private
     * 
     * @memberOf Promise
     */
    private _nextTickCallAlls() {
        if (!this._loop) {
            this._loop = true;
            nextTick(() => {
                this._callAlls();
                this._loop = false;
            });
        }
    }
    /**
     * 当前Promise状态是否可以被改变
     * 
     * @private
     * @returns {boolean}
     * 
     * @memberOf Boolean
     */
    private _canChange() {
        return this._currentState === PromiseState.PENDING;
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
     * 根据中间件返回值触发子 Promise
     * 
     * @static
     * @template T
     * @param {Promise<T>} promise 子Promise
     * @param {Promise<T>} x 中间件返回的值
     * 
     * @memberOf Promise
     */
    public static _Resolve<T>(promise: Promise<T>, x: Promise<T>) {
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

function isFunction(fn: any) {
    return typeof fn === 'function';
}

