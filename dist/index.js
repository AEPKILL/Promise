"use strict";
var PromiseState;
(function (PromiseState) {
    PromiseState[PromiseState["PENDING"] = 0] = "PENDING";
    PromiseState[PromiseState["RESOLVED"] = 1] = "RESOLVED";
    PromiseState[PromiseState["REJECTED"] = 2] = "REJECTED";
})(PromiseState || (PromiseState = {}));
;
;
;
;
;
var Promise = (function () {
    function Promise(provider) {
        // 当前 Promise 状态
        this._currentState = PromiseState.PENDING;
        // 当前 Promise Fulfilled 时的值
        this._value = null;
        // 是否是因为异常导致的 REJECTED
        this._exception = false;
        // 是否下个时间片会触发所有回调
        this._loop = false;
        // 本 Promise 派生出的子 Promise
        this._childrenPromises = [];
        if (isFunction(provider)) {
            try {
                provider(this._emitResolve.bind(this), this._emitReject.bind(this));
            }
            catch (err) {
                // 如果数据提供者内部发生异常则触发异常
                this._emitError(err);
            }
        }
        else {
            throw new TypeError("Promise resolver " + provider + " is not a function");
        }
    }
    Promise.prototype.then = function (resolve, reject, exception) {
        var deferred = Promise.Deferred();
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
    };
    Promise.prototype.reject = function (reject) {
        return this.then(undefined, reject);
    };
    Promise.prototype.catch = function (exception) {
        return this.then(undefined, undefined, exception);
    };
    /**
     * 私有函数: 使状态切换到 RESOLVED 并设置数据
     *
     * @private
     * @param {T} data
     *
     * @memberOf Promise
     */
    Promise.prototype._emitResolve = function (data) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.RESOLVED;
        }
        this._nextTickCallAlls();
    };
    /**
     * 私有函数: 使状态切换到 REJECTED 并设置数据
     *
     * @private
     * @param {*} data
     *
     * @memberOf Promise
     */
    Promise.prototype._emitReject = function (data) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.REJECTED;
        }
        this._nextTickCallAlls();
    };
    /**
     * 私有函数: 使状态切换到 REJECTED 并设置数据并设置是由数据提供者发生异常导致的
     *
     * @private
     * @param {Error} err
     *
     * @memberOf Promise
     */
    Promise.prototype._emitError = function (err) {
        if (this._canChange()) {
            this._exception = true;
            this._emitReject(err);
        }
        this._nextTickCallAlls();
    };
    /**
     * 状态改变时触发所有子 Promise
     *
     * @private
     *
     * @memberOf Promise
     */
    Promise.prototype._callAlls = function () {
        var children = null, result = null, call;
        while (this._childrenPromises.length) {
            children = this._childrenPromises.shift();
            // call 为中间件，一个Promise仅会被生效一个中间件
            if (this._currentState === PromiseState.RESOLVED) {
                call = children.resolve;
            }
            else if (this._currentState === PromiseState.REJECTED) {
                if (this._exception && children.exception) {
                    call = children.exception;
                }
                else {
                    call = children.reject;
                }
            }
            // 如果中间件为一个函数
            if (isFunction(call)) {
                try {
                    // 将中间件返回的值通过 _Resolve 应用于子 Promise
                    result = call.call(undefined, this._value);
                    Promise._Resolve(children.promise, result);
                }
                catch (err) {
                    // 中间件执行过程中发生异常则根据异常触发子Promise异常
                    children.promise._emitError(err);
                }
            }
            else {
                if (this._currentState === PromiseState.RESOLVED) {
                    children.promise._emitResolve(this._value);
                }
                else if (this._exception) {
                    children.promise._emitError(this._value);
                }
                else {
                    children.promise._emitReject(this._value);
                }
            }
        }
    };
    /**
     * 下个时间片触发所有子Promise
     *
     * @private
     *
     * @memberOf Promise
     */
    Promise.prototype._nextTickCallAlls = function () {
        var _this = this;
        if (!this._loop) {
            this._loop = true;
            nextTick(function () {
                _this._callAlls();
                _this._loop = false;
            });
        }
    };
    /**
     * 当前Promise状态是否可以被改变
     *
     * @private
     * @returns {boolean}
     *
     * @memberOf Boolean
     */
    Promise.prototype._canChange = function () {
        return this._currentState === PromiseState.PENDING;
    };
    Promise.Deferred = function () {
        var resolve, reject, promise = new Promise(function (_resolve, _reject) {
            resolve = _resolve;
            reject = _reject;
        });
        return {
            promise: promise,
            resolve: resolve,
            reject: reject
        };
    };
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
    Promise._Resolve = function (promise, x) {
        var called = false, xFn = null;
        if (promise === x) {
            throw new TypeError('promise === x');
        }
        try {
            if ((typeof x === 'object' || typeof x === 'function') && isFunction(xFn = x.then)) {
                try {
                    xFn.call(x, function (y) {
                        if (!called) {
                            called = true;
                            Promise._Resolve(promise, y);
                        }
                    }, function (y) {
                        if (!called) {
                            called = true;
                            promise._emitReject(y);
                        }
                    });
                }
                catch (err) {
                    if (!called) {
                        promise._emitError(err);
                    }
                }
            }
            else {
                promise._emitResolve(x);
            }
        }
        catch (err) {
            promise._emitError(err);
        }
    };
    return Promise;
}());
exports.Promise = Promise;
var nextTick = (function () {
    if (typeof process !== 'undefined' &&
        process == null &&
        isFunction(process.nextTick)) {
        return process.nextTick;
    }
    else {
        return function (fn) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            setTimeout.apply(void 0, [fn, 0].concat(args));
        };
    }
})();
function isFunction(fn) {
    return typeof fn === 'function';
}
