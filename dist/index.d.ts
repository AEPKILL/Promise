export interface IResolveCallback<T> {
    (data: T): Promise<T> | any;
}
export interface IRejectCallback<T> {
    (data: T | any): Promise<T> | any;
}
export interface IExceptionCallback {
    (data: Error): void;
}
export interface IChildrenPromise<T> {
    promise: Promise<T>;
    resolve: IResolveCallback<T>;
    reject: IRejectCallback<T>;
    exception: IExceptionCallback;
}
export interface IProvider<T> {
    (resolve: IResolveCallback<T>, reject: IRejectCallback<T>): void;
}
export declare class Promise<T> {
    private _currentState;
    private _value;
    private _exception;
    private _loop;
    private _childrenPromises;
    constructor(provider: IProvider<T>);
    then<U>(resolve?: IResolveCallback<T>, reject?: IRejectCallback<T>, exception?: IExceptionCallback): Promise<U>;
    reject(reject?: IRejectCallback<T>): Promise<{}>;
    catch(exception?: IExceptionCallback): Promise<{}>;
    private _emitResolve(data);
    private _emitReject(data);
    private _emitError(err);
    private _callAlls();
    private _nextTickCallAlls();
    private _canChange();
    static Deferred<T>(): {
        promise: Promise<T>;
        resolve: IResolveCallback<T>;
        reject: IRejectCallback<T>;
    };
    static _Resolve<T>(promise: Promise<T>, x: Promise<T>): void;
}
