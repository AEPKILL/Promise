/**
 * Adapter
 * 
 * resolved(value): creates a promise that is resolved with value.
 * rejected(reason): creates a promise that is already rejected with reason.
 * deferred(): creates an object consisting of { promise, resolve, reject }:
 *      promise is a promise that is currently in the pending state.
 *      resolve(value) resolves the promise with value.
 *      reject(reason) moves the promise from the pending state to the rejected state, with rejection reason reason.
 * 
 * A@AEPKILL.COM
 * 2016-10-7 21:28:02
 */

'use strict';
exports.deferred = function () {
    var resolve, reject, promise = new Promise(function (resolve, reject) {
        resolve = resolve;
        reject = reject;
    });
    return {
        resolve,
        reject,
        promise
    };
};
exports.resolved = function (value) {
    return new Promise(function (resolve) {
        resolve(value);
    });
};
exports.rejected = function (reason) {
    return new Promise(function (resolve, reject) {
        reject(reason);
    });
};