import async from './lib/async';
import listenerSorter from './lib/listenerSorter';
import tagsIntersect from './lib/tagsIntersect';
import {
    ListenerFunction,
    ListenerOptions,
    Listener,
    TriggerFilter,
    TriggerReturnValue,
    TriggerReturnType,
    EventOptions,
    ArgumentsTransformer,
    ArgumentsAppendTransformer,
    ArgumentsPrependTransformer,
    GenericEventArguments,
    GenericEventHandlerReturnValue,
} from './types';

/**
 * This class is private - you can't create an event other than via Observable.
 * @private
 */
export default class ObservableEvent<
    P extends GenericEventArguments = Array<any>,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> {
    listeners: Listener<P, R, O>[] = [];
    queue: Array<[P, TriggerReturnType | null]> = [];
    suspended: boolean = false;
    queued: boolean = false;
    triggered: number = 0;
    lastTrigger: P | undefined = undefined;
    sortListeners: boolean = false;

    async: boolean | number = false;
    limit: number = 0;
    autoTrigger: boolean | null = null;
    filter: TriggerFilter<P, R, O> | null = null;
    filterContext: object | null = null;
    appendArgs: ArgumentsAppendTransformer<P, R, O> | null = null;
    prependArgs: ArgumentsPrependTransformer<P, R, O> | null = null;
    replaceArgs: ArgumentsTransformer<P, R, O> | null = null;

    constructor(options?: EventOptions<P, R, O>) {
        if (options) {
            Object.assign(this, options);
        }
    }

    setOptions(options: EventOptions<P, R, O>) {
        Object.assign(this, options);
    }

    /**
     *
     */
    $destroy() {
        this.queue = [];
        this.listeners = [];
        this.filter = null;
        this.filterContext = null;
    }

    /**
     * @param fn Callback function
     * @param options
     */
    on(
        fn: ListenerFunction<O, R>,
        options: ListenerOptions<P, R, O> = {},
    ): void {
        if (!fn) {
            return;
        }

        const listeners = this.listeners;

        if (
            listeners.find((l) => l.fn === fn && l.context === options.context)
        ) {
            return;
        }

        const listener: Listener<P, R, O> = {
            fn: fn,
            context: undefined,
            async: false,
            called: 0, // how many times the function was triggered
            limit: 0, // how many times the function is allowed to trigger
            start: 1, // from which attempt it is allowed to trigger the function
            count: 0, // how many attempts to trigger the function was made
            index: 0,
        };

        Object.assign(listener, options);

        if (listener.async === true) {
            listener.async = 1;
        }
        if (options.first === true || options.alwaysFirst === true) {
            listeners.unshift(listener);
        } else {
            listeners.push(listener);
        }

        if (this.sortListeners) {
            this.listeners = listeners
                .map((l: Listener<P, R, O>, inx: number): Listener<P, R, O> => {
                    l.index = inx;
                    return l;
                })
                .sort(listenerSorter<P, R, O>);
        }

        if (options.alwaysFirst === true || options.alwaysLast === true) {
            this.sortListeners = true;
        }

        if (
            this.autoTrigger &&
            this.lastTrigger !== undefined &&
            !this.suspended
        ) {
            const prevFilter = this.filter;
            this.filter = (args: O, l?: Listener<P, R, O>) => {
                if (l && l.fn === fn) {
                    return prevFilter ? prevFilter(args, l) !== false : true;
                }
                return false;
            };
            this.trigger(this.lastTrigger);
            this.filter = prevFilter;
        }
    }

    /**
     * @param fn Callback function
     * @param context
     * @param tag
     * @return boolean
     */
    un(
        fn: ListenerFunction<O, R>,
        context?: object | null,
        tag?: string,
    ): boolean {
        const listeners = this.listeners;
        const inx = listeners.findIndex((l) => {
            if (l.fn !== fn) {
                return false;
            }
            if (!!l.context !== !!context) {
                return false;
            }
            if (!!context && l.context !== context) {
                return false;
            }
            if (!!tag && (!l.tags || l.tags.indexOf(tag) === -1)) {
                return false;
            }
            return true;
        });

        if (inx === -1) {
            return false;
        }

        listeners.splice(inx, 1);
        return true;
    }

    /**
     * @param fn Callback function
     * @param context
     * @param tag
     * @return boolean
     */
    hasListener(
        fn?: ListenerFunction<O, R> | null,
        context?: object | null,
        tag?: string | null,
    ): boolean {
        if (fn) {
            return (
                this.listeners.findIndex((l) => {
                    if (l.fn !== fn) {
                        return false;
                    }
                    if (context && l.context !== context) {
                        return false;
                    }
                    if (tag && (!l.tags || l.tags.indexOf(tag) === -1)) {
                        return false;
                    }
                    return true;
                }) !== -1
            );
        }
        if (tag) {
            return (
                this.listeners.findIndex(
                    (l) => l.tags && l.tags.indexOf(tag) !== -1,
                ) !== -1
            );
        } else {
            return this.listeners.length > 0;
        }
    }

    removeAllListeners(tag?: string) {
        if (tag) {
            this.listeners = this.listeners.filter((l) => {
                return !l.tags || l.tags.indexOf(tag) === -1;
            });
        } else {
            this.listeners = [];
        }
    }

    suspend(withQueue: boolean = false) {
        this.suspended = true;
        if (withQueue) {
            this.queued = true;
        }
    }

    resume() {
        this.suspended = false;
        this.queued = false;

        if (this.queue.length > 0) {
            for (let i = 0, l = this.queue.length; i < l; i++) {
                this.trigger(this.queue[i][0], this.queue[i][1]);
            }
            this.queue = [];
        }
    }

    getFilterContext(l: Listener<P, R, O>): object | undefined {
        return l.filterContext || this.filterContext || l.context;
    }

    prepareArgs(l: Listener<P, R, O>, triggerArgs: P): O {
        let outputArgs: O = triggerArgs as unknown as O;

        const append: ArgumentsAppendTransformer<P, R, O> | null =
                l.appendArgs || this.appendArgs || null,
            prepend: ArgumentsPrependTransformer<P, R, O> | null =
                l.prependArgs || this.prependArgs || null,
            repl: ArgumentsTransformer<P, R, O> | null =
                l.replaceArgs || this.replaceArgs || null;

        if (append || prepend) {
            if (prepend) {
                if (typeof prepend === 'function') {
                    outputArgs = [
                        ...prepend(l, triggerArgs),
                        ...outputArgs,
                    ] as O;
                } else {
                    outputArgs = [...prepend, ...outputArgs] as O;
                }
            }
            if (append) {
                if (typeof append === 'function') {
                    outputArgs = [
                        ...outputArgs,
                        ...append(l, triggerArgs),
                    ] as O;
                } else {
                    outputArgs = [...outputArgs, ...append] as O;
                }
            }
        } else if (repl) {
            if (typeof repl === 'function') {
                outputArgs = [...repl(l, triggerArgs)] as O;
            } else {
                outputArgs = [...repl] as O;
            }
        }

        return outputArgs;
    }

    lcall(
        listener: Listener<P, R, O>,
        args: O,
        resolve: null | ((any: R) => void) = null,
    ): TriggerReturnValue<R> | void {
        const isAsync = listener.async !== false ? listener.async : this.async;
        const fn = listener.fn as ListenerFunction<O, R>;
        const result =
            isAsync !== false
                ? /* promise */ async<O, R>(
                      fn,
                      listener.context,
                      args,
                      isAsync === true ? 0 : isAsync,
                  )
                : /* value or promise */ fn.bind(listener.context)(...args);
        if (resolve !== null) {
            resolve(result as R);
        } else {
            return result;
        }
    }

    lcallWPrev(
        listener: Listener<P, R, O>,
        args: O,
        prevValue: R,
        returnType: TriggerReturnType,
    ): TriggerReturnValue<R> {
        if (returnType === TriggerReturnType.PIPE) {
            args[0] = prevValue;
            args = this.prepareArgs(listener, args as unknown as P);
            return this.lcall(listener, args) as TriggerReturnValue<R>;
        } else if (
            returnType === TriggerReturnType.UNTIL_TRUE &&
            prevValue === true
        ) {
            return true;
        } else if (
            returnType === TriggerReturnType.UNTIL_FALSE &&
            prevValue === false
        ) {
            return false;
        } else if (
            returnType === TriggerReturnType.FIRST_NON_EMPTY &&
            prevValue !== null &&
            prevValue !== undefined
        ) {
            return prevValue;
        }
        return this.lcall(listener, args) as TriggerReturnValue<R>;
    }

    trigger(
        origArgs: P,
        returnType: TriggerReturnType | null = null,
        tags?: string[] | null,
    ): TriggerReturnValue<R> {
        if (this.queued) {
            this.queue.push([origArgs, returnType]);
            return;
        }
        if (this.suspended) {
            return;
        }
        if (this.limit > 0 && this.triggered >= this.limit) {
            return;
        }
        this.triggered++;

        if (this.autoTrigger) {
            this.lastTrigger = origArgs.slice() as P;
        }

        // in pipe mode if there is no listeners,
        // we just return piped value
        if (this.listeners.length === 0) {
            if (returnType === TriggerReturnType.PIPE) {
                return origArgs[0];
            } else if (
                returnType === TriggerReturnType.ALL ||
                returnType === TriggerReturnType.CONCAT ||
                returnType === TriggerReturnType.RAW
            ) {
                return [];
            } else if (returnType === TriggerReturnType.MERGE) {
                return {};
            }
            return;
        }

        const results: any[] = [],
            queue: Listener<P, R, O>[] = this.listeners.slice(),
            isConsequent =
                returnType === TriggerReturnType.PIPE ||
                returnType === TriggerReturnType.UNTIL_TRUE ||
                returnType === TriggerReturnType.UNTIL_FALSE ||
                returnType === TriggerReturnType.FIRST_NON_EMPTY;

        let args: O,
            listener: Listener<P, R, O> | undefined,
            listenerResult: any = null,
            hasPromises = false;

        while ((listener = queue.shift())) {
            if (!listener) {
                continue;
            }

            args = this.prepareArgs(listener, origArgs);

            if (
                this.filter &&
                this.filter.call(this.filterContext, args, listener) === false
            ) {
                continue;
            }

            if (
                listener.filter &&
                listener.filter.call(this.getFilterContext(listener), args) ===
                    false
            ) {
                continue;
            }

            if (
                tags &&
                tags.length > 0 &&
                (!listener.tags || !tagsIntersect(tags, listener.tags))
            ) {
                continue;
            }

            listener.count++;

            if (
                listener.start !== undefined &&
                listener.count < listener.start
            ) {
                continue;
            }

            if (isConsequent && results.length > 0) {
                let prev = results[results.length - 1];
                if (hasPromises) {
                    if (!(prev instanceof Promise)) {
                        prev = Promise.resolve(prev);
                    }
                    listenerResult = prev.then(
                        ((listener, args, returnType) => (value: R) => {
                            return this.lcallWPrev(
                                listener,
                                args,
                                value,
                                returnType,
                            );
                        })(listener, args, returnType),
                    );
                } else {
                    listenerResult = this.lcallWPrev(
                        listener,
                        args,
                        prev,
                        returnType,
                    );
                }
            } else {
                listenerResult = this.lcall(listener, args);
            }

            listener.called++;

            if (listener.called === listener.limit) {
                this.un(listener.fn, listener.context);
            }

            if (returnType === TriggerReturnType.FIRST) {
                return listenerResult;
            }

            if (isConsequent) {
                switch (returnType) {
                    case TriggerReturnType.UNTIL_TRUE: {
                        if (listenerResult === true) {
                            return true;
                        }
                        break;
                    }
                    case TriggerReturnType.UNTIL_FALSE: {
                        if (listenerResult === false) {
                            return false;
                        }
                        break;
                    }
                    case TriggerReturnType.FIRST_NON_EMPTY: {
                        if (
                            !hasPromises &&
                            !(listenerResult instanceof Promise) &&
                            listenerResult !== null &&
                            listenerResult !== undefined
                        ) {
                            return listenerResult;
                        }
                        break;
                    }
                }
            }

            if (!hasPromises && listenerResult instanceof Promise) {
                hasPromises = true;
            }

            results.push(listenerResult);
        }

        switch (returnType) {
            case TriggerReturnType.RAW: {
                return results;
            }
            case undefined:
            case null: {
                if (hasPromises) {
                    return Promise.all(results).then(() => {}) as R;
                }
                return;
            }
            case TriggerReturnType.ALL: {
                return hasPromises ? Promise.all(results) : results;
            }
            case TriggerReturnType.CONCAT: {
                return hasPromises
                    ? (Promise.all(results).then((results) =>
                          results.flat(),
                      ) as Promise<R[]>)
                    : (results.flat() as R[]);
            }
            case TriggerReturnType.MERGE: {
                return hasPromises
                    ? Promise.all(results).then((results) =>
                          Object.assign.apply(null, [{}, ...results]),
                      )
                    : Object.assign.apply(null, [{}, ...results]);
            }
            case TriggerReturnType.LAST: {
                return results.pop();
            }
            case TriggerReturnType.UNTIL_TRUE: {
                return;
            }
            case TriggerReturnType.UNTIL_FALSE: {
                return;
            }
            case TriggerReturnType.FIRST_NON_EMPTY: {
                return Promise.all(results).then((results) =>
                    results.find((r) => r !== undefined && r !== null),
                );
            }
            case TriggerReturnType.PIPE: {
                return results[results.length - 1];
            }
        }
    }

    resolve(
        origArgs: P,
        returnType: TriggerReturnType | null = null,
        tags?: string[] | null,
    ): Promise<TriggerReturnValue<R>> {
        return Promise.resolve(this.trigger(origArgs, returnType, tags));
    }
}
