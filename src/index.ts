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
    private _currentState = PromiseState.PENDING;
    private _value: any = null;
    private _exception = false;
    private _loop = false;
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
    public then<U>(resolve?: IResolveCallback<T>, reject?: IRejectCallback<T>, exception?: IExceptionCallback): Promise<U> {
        let deferred = Promise.Deferred<U>();
        this._childrenPromises.push({
            resolve: resolve,
            reject: reject,
            exception: exception,
            promise: deferred.promise
        });
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



    private _emitResolve(data: T) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.RESOLVED;
        }
        this._nextTickCallAlls();
    }
    private _emitReject(data: any) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.REJECTED;
        }
        this._nextTickCallAlls();
    }
    private _emitError(err: Error) {
        if (this._canChange()) {
            this._exception = true;
            this._emitReject(err);
        }
        this._nextTickCallAlls();
    }
    private _callAlls() {
        let children: IChildrenPromise<any> = null, result: any = null, call: (data: any) => any;
        while (this._childrenPromises.length) {
            children = this._childrenPromises.shift();
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
        if (!this._loop) {
            this._loop = true;
            nextTick(() => {
                this._callAlls();
                this._loop = false;
            });
        }
    }
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

function canReadPropery(obj: any) {
    return obj == undefined;
}

