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
    MapKey,
    GetEventArguments,
    GetEventHandlerReturnValue,
    GetEventHandlerArguments,
} from './types';

/**
 * This class is private - you can't create an event other than via Observable.
 * @private
 */
export default class ObservableEvent<Id extends MapKey, E extends MapKey> {
    listeners: Listener<Id, E>[] = [];
    queue: Array<[GetEventArguments<Id, E>, TriggerReturnType | null]> = [];
    suspended: boolean = false;
    queued: boolean = false;
    triggered: number = 0;
    lastTrigger: GetEventArguments<Id, E> | undefined = undefined;
    sortListeners: boolean = false;

    async: boolean | number = false;
    limit: number = 0;
    autoTrigger: boolean | null = null;
    filter: TriggerFilter<Id, E> | null = null;
    filterContext: object | null = null;
    appendArgs: ArgumentsAppendTransformer<Id, E> | null = null;
    prependArgs: ArgumentsPrependTransformer<Id, E> | null = null;
    replaceArgs: ArgumentsTransformer<Id, E> | null = null;

    constructor(options?: EventOptions<Id, E>) {
        if (options) {
            Object.assign(this, options);
        }
    }

    setOptions(options: EventOptions<Id, E>) {
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
        fn: ListenerFunction<
            GetEventHandlerArguments<Id, E>,
            GetEventHandlerReturnValue<Id, E>
        >,
        options: ListenerOptions<Id, E> = {},
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

        const listener: Listener<Id, E> = {
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
                .map((l: Listener<Id, E>, inx: number): Listener<Id, E> => {
                    l.index = inx;
                    return l;
                })
                .sort(listenerSorter<Id, E>);
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
            this.filter = (
                args: GetEventHandlerArguments<Id, E>,
                l?: Listener<Id, E>,
            ) => {
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
        fn: ListenerFunction<
            GetEventHandlerArguments<Id, E>,
            GetEventHandlerReturnValue<Id, E>
        >,
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
        fn?: ListenerFunction<
            GetEventHandlerArguments<Id, E>,
            GetEventHandlerReturnValue<Id, E>
        > | null,
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

    getFilterContext(l: Listener<Id, E>): object | undefined {
        return l.filterContext || this.filterContext || l.context;
    }

    prepareArgs(
        l: Listener<Id, E>,
        triggerArgs: GetEventArguments<Id, E>,
    ): GetEventHandlerArguments<Id, E> {
        let outputArgs: GetEventHandlerArguments<Id, E> =
            triggerArgs as GetEventHandlerArguments<Id, E>;

        const append: ArgumentsAppendTransformer<Id, E> | null =
                l.appendArgs || this.appendArgs || null,
            prepend: ArgumentsPrependTransformer<Id, E> | null =
                l.prependArgs || this.prependArgs || null,
            repl: ArgumentsTransformer<Id, E> | null =
                l.replaceArgs || this.replaceArgs || null;

        if (append || prepend) {
            if (prepend) {
                if (typeof prepend === 'function') {
                    outputArgs = [
                        ...prepend(l, triggerArgs),
                        ...outputArgs,
                    ] as GetEventHandlerArguments<Id, E>;
                } else {
                    outputArgs = [
                        ...prepend,
                        ...outputArgs,
                    ] as GetEventHandlerArguments<Id, E>;
                }
            }
            if (append) {
                if (typeof append === 'function') {
                    outputArgs = [
                        ...outputArgs,
                        ...append(l, triggerArgs),
                    ] as GetEventHandlerArguments<Id, E>;
                } else {
                    outputArgs = [
                        ...outputArgs,
                        ...append,
                    ] as GetEventHandlerArguments<Id, E>;
                }
            }
        } else if (repl) {
            if (typeof repl === 'function') {
                outputArgs = [
                    ...repl(l, triggerArgs),
                ] as GetEventHandlerArguments<Id, E>;
            } else {
                outputArgs = [...repl] as GetEventHandlerArguments<Id, E>;
            }
        }

        return outputArgs;
    }

    lcall(
        listener: Listener<Id, E>,
        args: GetEventHandlerArguments<Id, E>,
        resolve:
            | null
            | ((any: GetEventHandlerReturnValue<Id, E>) => void) = null,
    ):
        | GetEventHandlerReturnValue<Id, E>
        | Promise<GetEventHandlerReturnValue<Id, E>> {
        const isAsync = listener.async !== false ? listener.async : this.async;
        const fn = listener.fn;
        const result =
            isAsync !== false
                ? /* promise */ async<
                      GetEventHandlerArguments<Id, E>,
                      GetEventHandlerReturnValue<Id, E>
                  >(fn, listener.context, args, isAsync === true ? 0 : isAsync)
                : /* value or promise */ fn.bind(listener.context)(...args);

        if (resolve !== null) {
            if (result instanceof Promise) {
                result.then(resolve);
            } else {
                resolve(result);
            }
        }

        return result;
    }

    lcallWPrev(
        listener: Listener<Id, E>,
        args: GetEventHandlerArguments<Id, E>,
        prevValue: GetEventHandlerReturnValue<Id, E>,
        returnType: TriggerReturnType,
    ):
        | GetEventHandlerReturnValue<Id, E>
        | Promise<GetEventHandlerReturnValue<Id, E>>
        | boolean {
        if (returnType === TriggerReturnType.PIPE) {
            args[0] = prevValue;
            args = this.prepareArgs(listener, args as GetEventArguments<Id, E>);
            return this.lcall(listener, args);
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
        return this.lcall(listener, args);
    }

    trigger(
        origArgs: GetEventArguments<Id, E>,
        returnType: TriggerReturnType | null = null,
        tags?: string[] | null,
    ): TriggerReturnValue<GetEventHandlerReturnValue<Id, E>> {
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
            this.lastTrigger = origArgs.slice() as GetEventArguments<Id, E>;
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
            queue: Listener<Id, E>[] = this.listeners.slice(),
            isConsequent =
                returnType === TriggerReturnType.PIPE ||
                returnType === TriggerReturnType.UNTIL_TRUE ||
                returnType === TriggerReturnType.UNTIL_FALSE ||
                returnType === TriggerReturnType.FIRST_NON_EMPTY;

        let args: GetEventHandlerArguments<Id, E>,
            listener: Listener<Id, E> | undefined,
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
                        (
                            (listener, args, returnType) =>
                            (value: GetEventHandlerReturnValue<Id, E>) => {
                                return this.lcallWPrev(
                                    listener,
                                    args,
                                    value,
                                    returnType,
                                );
                            }
                        )(listener, args, returnType),
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
                    return Promise.all(results).then(
                        () => undefined,
                    ) as Promise<undefined>;
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
                      ) as Promise<GetEventHandlerReturnValue<Id, E>[]>)
                    : results.flat();
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
        origArgs: GetEventArguments<Id, E>,
        returnType: TriggerReturnType | null = null,
        tags?: string[] | null,
    ): Promise<TriggerReturnValue<GetEventHandlerReturnValue<Id, E>>> {
        return Promise.resolve(this.trigger(origArgs, returnType, tags));
    }
}
