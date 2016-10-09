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
        this._currentState = PromiseState.PENDING;
        this._value = null;
        this._exception = false;
        this._loop = false;
        this._childrenPromises = [];
        if (isFunction(provider)) {
            try {
                provider(this._emitResolve.bind(this), this._emitReject.bind(this));
            }
            catch (err) {
                this._emitError(err);
            }
        }
        else {
            throw new TypeError("Promise resolver " + provider + " is not a function");
        }
    }
    Promise.prototype.then = function (resolve, reject, exception) {
        var deferred = Promise.Deferred();
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
    };
    Promise.prototype.reject = function (reject) {
        return this.then(undefined, reject);
    };
    Promise.prototype.catch = function (exception) {
        return this.then(undefined, undefined, exception);
    };
    Promise.prototype._emitResolve = function (data) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.RESOLVED;
        }
        this._nextTickCallAlls();
    };
    Promise.prototype._emitReject = function (data) {
        if (this._canChange()) {
            this._value = data;
            this._currentState = PromiseState.REJECTED;
        }
        this._nextTickCallAlls();
    };
    Promise.prototype._emitError = function (err) {
        if (this._canChange()) {
            this._exception = true;
            this._emitReject(err);
        }
        this._nextTickCallAlls();
    };
    Promise.prototype._callAlls = function () {
        var children = null, result = null, call;
        while (this._childrenPromises.length) {
            children = this._childrenPromises.shift();
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
            if (isFunction(call)) {
                try {
                    result = call.call(undefined, this._value);
                    Promise._Resolve(children.promise, result);
                }
                catch (err) {
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
    Promise._Resolve = function (promise, x) {
        var called = false, xFn = null;
        if (promise === x) {
            throw new TypeError('promise === x');
        }
        try {
            if (x != undefined &&
                typeof x != 'number' &&
                typeof x != 'boolean'
                && isFunction(xFn = x.then)) {
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
function canReadPropery(obj) {
    return obj == undefined;
}
