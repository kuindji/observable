import ObservableEvent from './ObservableEvent';
import {
    ObservablePubliApi,
    TriggerReturnType,
    EventOptions,
    ListenerOptions,
    ListenerFunction,
    TriggerReturnValue,
    EventSource,
    ProxyType,
    ProxyListener,
    InterceptorFunction,
    WithTagCallback,
    EventMap,
    GetEventArguments,
    GetEventHandlerReturnValue,
    EventName,
    GetEventHandlerArguments,
    ReturnableProxyType,
    GenericEventArguments,
    GenericEventHandlerReturnValue,
} from './types';

type EventStore<Id extends symbol | string> = Record<
    keyof EventMap[Id] | string | symbol,
    ObservableEvent<GenericEventArguments, GenericEventHandlerReturnValue>
>;

type ProxyListenerMap = {
    [key: string]: ProxyListener;
};

/**
 * A javascript event bus implementing multiple patterns:
 * observable, collector and pipe.
 * @author Ivan Kuindzhi
 */
export default class Observable<Id extends symbol | string = any> {
    events: EventStore<Id> = {} as EventStore<Id>;
    external: ProxyListenerMap = {};
    eventSources: EventSource[] = [];
    publicApi: ObservablePubliApi<Id> | null = null;
    interceptor: InterceptorFunction | null = null;
    _tags?: string[] | null = null;

    withTags(tags: string[], fn: WithTagCallback) {
        this._tags = tags;
        fn();
        this._tags = undefined;
    }

    /**
     * @param name
     * @param options
     * @deprecated
     */
    createEvent<K extends EventName<Id>>(
        name: K,
        options: EventOptions<
            GetEventArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>,
            GetEventHandlerArguments<Id, K>
        >,
    ): void {
        this.setEventOptions(name, options);
    }

    /**
     * Use this method only if you need to provide event-level options or listener argument types.
     * @param name Event name
     * @param options Event options
     */
    setEventOptions<K extends EventName<Id>>(
        name: K,
        options: EventOptions<
            GetEventArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>,
            GetEventHandlerArguments<Id, K>
        >,
    ): void {
        if (!this.events[name]) {
            this.events[name] = new ObservableEvent<
                GetEventArguments<Id, K>,
                GetEventHandlerReturnValue<Id, K>,
                GetEventHandlerArguments<Id, K>
            >(options);
        } else {
            this.events[name].setOptions(options);
        }
    }

    /**
     * Subscribe to an event or register collector function.
     * @param name Event name. Use '*' to subscribe to all events.
     * @param fn Callback function
     * @param options You can pass any key-value pairs in this object. All of them will be passed
     *       to triggerFilter (if you're using one).
     */
    on<K extends EventName<Id>>(
        name: K,
        fn: ListenerFunction<
            GetEventHandlerArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>
        >,
        options?: ListenerOptions<
            GetEventArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>,
            GetEventHandlerArguments<Id, K>
        >,
    ): void {
        if (this.eventSources.length > 0) {
            this.eventSources.forEach((evs: EventSource) => {
                if (
                    evs.accepts === false ||
                    (typeof evs.accepts === 'function' &&
                        !evs.accepts(name as string | symbol))
                ) {
                    return;
                }
                if (evs.subscribed.indexOf(name) === -1) {
                    evs.on(
                        name as string | symbol,
                        this.proxy(name, evs.proxyType),
                        evs,
                        options as ListenerOptions<any[], any, any[]>,
                    );
                    evs.subscribed.push(name);
                }
            });
        }

        if (!this.events[name]) {
            this.events[name] = new ObservableEvent<
                GetEventArguments<Id, K>,
                GetEventHandlerReturnValue<Id, K>,
                GetEventHandlerArguments<Id, K>
            >();
        }
        this.events[name].on(fn, options);
    }

    /**
     * Same as <code>on()</code>, but options.limit is forcefully set to 1.
     * @param name Event name
     * @param fn Listener
     * @param options? listener options
     */
    once<K extends EventName<Id>>(
        name: K,
        fn: ListenerFunction<
            GetEventHandlerArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>
        >,
        options?: ListenerOptions<
            GetEventArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>,
            GetEventHandlerArguments<Id, K>
        >,
    ): void {
        options = options || {};
        options.limit = 1;
        this.on(name, fn, options);
    }

    /**
     * Same as <code>once()</code> but as Promise with event payload as resolved value
     * @param name Event name
     * @param options?
     */
    promise<K extends EventName<Id>>(
        name: K,
        options?: ListenerOptions<
            GetEventArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>,
            GetEventHandlerArguments<Id, K>
        >,
    ): Promise<GetEventHandlerArguments<Id, K>> {
        return new Promise((resolve) => {
            this.once(
                name,
                (...args: GetEventHandlerArguments<Id, K>): any => {
                    resolve(args);
                },
                options,
            );
        });
    }

    /**
     * Intercept all triggers and return boolean to allow or disallow event call
     * @param fn
     */
    intercept(fn: InterceptorFunction) {
        this.interceptor = fn;
    }

    /**
     * Stop intercepting triggers
     */
    stopIntercepting() {
        this.interceptor = null;
    }

    /**
     * Unsubscribe from an event
     * @param name Event name
     * @param fn Event handler
     * @param context If you called on() with context you must
     *                         call un() with the same context
     */
    un<K extends EventName<Id>>(
        name: K,
        fn: ListenerFunction<
            GetEventHandlerArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>
        >,
        context?: object | null,
        tag?: string,
    ): void {
        const events = this.events;
        if (events[name]) {
            events[name].un(fn, context, tag);
        }

        if (this.eventSources.length > 0) {
            const empty = !events[name].hasListener();
            this.eventSources.forEach((evs: EventSource) => {
                const inx = evs.subscribed.indexOf(name);
                const key =
                    (name as string) +
                    '-' +
                    (evs.proxyType || ProxyType.TRIGGER);
                if (inx !== -1) {
                    evs.subscribed.splice(inx, 1);
                    if (empty) {
                        evs.un(name as string, this.external[key], evs, tag);
                    }
                }
            });
        }
    }

    /**
     * Relay all events of <code>eventSource</code> through this observable.
     * @param eventSource another Observable
     * @param eventName
     * @param triggerName
     * @param triggerNamePfx prefix all relayed event names
     * @param proxyType
     */
    relay<
        ExternalId extends symbol | string = any,
        KS extends EventName<ExternalId> = string | symbol,
        KT extends EventName<Id> = string | symbol,
    >(
        eventSource: Observable<ExternalId>,
        eventName: KS,
        triggerName?: KT | null,
        triggerNamePfx?: string | null,
        proxyType: ProxyType = ProxyType.TRIGGER,
    ) {
        if (eventName === '*') {
            const l = this[proxyType] as ListenerFunction<
                GetEventArguments<ExternalId, KS>,
                GetEventHandlerReturnValue<ExternalId, KS>
            >;
            eventSource.on(eventName, l, {
                context: this,
                replaceArgs: (l, args: GetEventArguments<ExternalId, KS>) => {
                    if (triggerNamePfx) {
                        args[0] = triggerNamePfx + args[0];
                    }
                    return args as GetEventHandlerArguments<ExternalId, KS>;
                },
            });
        } else {
            const l = this[proxyType] as ListenerFunction<
                GetEventArguments<ExternalId, KS>,
                GetEventHandlerReturnValue<ExternalId, KS>
            >;
            eventSource.on(eventName, l, {
                context: this,
                prependArgs: [triggerName || eventName],
            });
        }
    }

    /**
     * Stop relaying events of <code>eventSource</code>
     * @param eventSource
     * @param eventName
     */
    unrelay<
        ExternalId extends symbol | string = any,
        KS extends EventName<ExternalId> = string | symbol,
    >(
        eventSource: Observable<ExternalId>,
        eventName: KS,
        proxyType: ProxyType = ProxyType.TRIGGER,
    ) {
        const l = this[proxyType] as ListenerFunction<
            GetEventArguments<ExternalId, KS>,
            GetEventHandlerReturnValue<ExternalId, KS>
        >;
        eventSource.un(eventName, l, this);
    }

    /**
     * @param eventSource
     */
    addEventSource(eventSource: EventSource): void {
        if (!this.hasEventSource(eventSource.name)) {
            this.eventSources.push({
                proxyType: ProxyType.TRIGGER,
                ...eventSource,
                subscribed: [],
            });
        }
    }

    /**
     * @param name  eventSource name or eventSource
     */
    removeEventSource(name: string | EventSource) {
        const inx = this.eventSources.findIndex((evs) =>
            typeof name === 'string'
                ? evs.name === name
                : evs.name === name.name,
        );
        if (inx !== -1) {
            const evs = this.eventSources[inx];
            evs.subscribed.forEach((name: string) => {
                const key = name + '-' + evs.proxyType;
                evs.un(name, this.external[key], evs);
            });
            this.eventSources.splice(inx, 1);
        }
    }

    /**
     * Check if event source with given name was added
     * @param name
     */
    hasEventSource(name: string | symbol | EventSource): boolean {
        const inx = this.eventSources.findIndex((evs) =>
            typeof name === 'string' || typeof name === 'symbol'
                ? evs.name === name
                : evs.name === name.name,
        );
        return inx !== -1;
    }

    /**
     * Create a listener function for external event bus that will relay events through
     * this observable
     * @param name Event name in this observable
     * @param proxyType
     */
    proxy<K extends EventName<Id>>(
        name: K,
        proxyType?: ProxyType,
    ): ProxyListener<
        GetEventArguments<Id, K>,
        | GetEventHandlerReturnValue<Id, K>
        | Promise<GetEventHandlerReturnValue<Id, K> | undefined>
        | Array<GetEventHandlerReturnValue<Id, K>>
        | Promise<Array<GetEventHandlerReturnValue<Id, K>>>
        | undefined
    > {
        const key = (name as string) + '-' + (proxyType || ProxyType.TRIGGER);
        if (!this.external[key]) {
            this.external[key] = (...args: GetEventArguments<Id, K>) => {
                if (
                    proxyType !== undefined &&
                    proxyType !== null &&
                    proxyType !== ProxyType.TRIGGER &&
                    proxyType !== ProxyType.UNTIL_FALSE &&
                    proxyType !== ProxyType.UNTIL_TRUE
                ) {
                    const fn =
                        this[proxyType as ReturnableProxyType].bind(this);
                    return fn(name as string | symbol, ...args);
                } else {
                    this[proxyType || ProxyType.TRIGGER].apply(this, [
                        name as string | symbol,
                        ...args,
                    ]);
                }
            };
        }
        return this.external[key];
    }

    /**
     * @param name Event name
     * @param fn Callback function
     * @param context
     */
    has<K extends EventName<Id>>(
        name?: K,
        fn?: ListenerFunction<
            GetEventHandlerArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>
        > | null,
        context?: object | null,
        tag?: string,
    ): boolean {
        const events = this.events;

        if (name) {
            if (!events[name]) {
                return false;
            }
            return events[name].hasListener(fn, context, tag);
        } else {
            for (const eventName in events) {
                if (events[eventName].hasListener(undefined, undefined, tag)) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * @deprecated
     * Same as has()
     * @param name
     * @param fn
     * @param context
     */
    hasListener<K extends EventName<Id>>(
        name?: K,
        fn?: ListenerFunction<
            GetEventHandlerArguments<Id, K>,
            GetEventHandlerReturnValue<Id, K>
        > | null,
        context?: object | null,
        tag?: string,
    ): boolean {
        return this.has(name, fn, context, tag);
    }

    /**
     * Remove all listeners from specific event or from all events
     * @param name Event name
     */
    removeAllListeners<K extends EventName<Id>>(name?: K, tag?: string) {
        const events = this.events;
        if (name) {
            if (!events[name]) {
                return;
            }
            events[name].removeAllListeners(tag);
        } else {
            for (const eventName in events) {
                events[eventName].removeAllListeners(tag);
            }
        }
    }

    /**
     * Trigger event and return all results from the listeners
     * @param name Event name
     * @param [...args]
     */
    all<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Array<GetEventHandlerReturnValue<Id, K>> {
        return this._trigger(name, args, TriggerReturnType.ALL);
    }

    /**
     * Trigger event and return a promise with results from the listeners
     * @param name Event name
     * @param [...args]
     */
    resolveAll<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<Array<GetEventHandlerReturnValue<Id, K>>> {
        return this._trigger(name, args, TriggerReturnType.ALL, true);
    }

    /**
     * Trigger first event's listener and return its result
     * @param name Event name
     * @param [...args]
     */
    first<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): GetEventHandlerReturnValue<Id, K> | undefined {
        return this._trigger(name, args, TriggerReturnType.FIRST);
    }

    /**
     * Trigger first event's listener and return its result as a promise
     * @param name Event name
     * @param [...args]
     */
    resolveFirst<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<GetEventHandlerReturnValue<Id, K>> {
        return this._trigger(name, args, TriggerReturnType.FIRST, true);
    }

    /**
     * Trigger event and return last listener's result
     * @param name Event name
     * @param [...args]
     */
    last<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): GetEventHandlerReturnValue<Id, K> | undefined {
        return this._trigger(name, args, TriggerReturnType.LAST);
    }

    /**
     * Trigger event and return last listener's result as a promise
     * @param name Event name
     * @param [...args]
     */
    resolveLast<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<GetEventHandlerReturnValue<Id, K>> {
        return this._trigger(name, args, TriggerReturnType.LAST, true);
    }

    /**
     * Trigger event and return all results from the listeners merged into one object
     * @param name Event name
     * @param [...args]
     */
    merge<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): GetEventHandlerReturnValue<Id, K> {
        return this._trigger(name, args, TriggerReturnType.MERGE);
    }

    /**
     * Trigger event and return as a promise all results from the listeners merged into one object
     * @param name Event name
     * @param [...args]
     */
    resolveMerge<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<GetEventHandlerReturnValue<Id, K>> {
        return this._trigger(name, args, TriggerReturnType.MERGE, true);
    }

    /**
     * Trigger event and return all results from the listeners flattened into one array
     * @param name Event name
     * @param [...args]
     */
    concat<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Array<GetEventHandlerReturnValue<Id, K>> {
        return this._trigger(name, args, TriggerReturnType.CONCAT);
    }

    /**
     * Trigger event and return as a promise all results from the listeners flattened into one array
     * @param name Event name
     * @param [...args]
     */
    resolveConcat<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<Array<GetEventHandlerReturnValue<Id, K>>> {
        return this._trigger(name, args, TriggerReturnType.CONCAT, true);
    }

    /**
     * Trigger event and return first non-empty listener result and skip others
     * @param name Event name
     * @param [...args]
     */
    firstNonEmpty<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): GetEventHandlerReturnValue<Id, K> | undefined {
        return this._trigger(name, args, TriggerReturnType.FIRST_NON_EMPTY);
    }

    /**
     * Trigger event and return as a promise first non-empty listener result and skip others
     * @param name Event name
     * @param [...args]
     */
    resolveFirstNonEmpty<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<GetEventHandlerReturnValue<Id, K> | undefined> {
        return this._trigger(
            name,
            args,
            TriggerReturnType.FIRST_NON_EMPTY,
            true,
        );
    }

    /**
     * Trigger event and return first listener result that equals true and skip others
     * @param name Event name
     * @param [...args]
     */
    untilTrue<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): void {
        this._trigger(name, args, TriggerReturnType.UNTIL_TRUE);
    }

    /**
     * Trigger event and return first listener result that equals false and skip others
     * @param name Event name
     * @param [...args]
     */
    untilFalse<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): void {
        this._trigger(name, args, TriggerReturnType.UNTIL_FALSE);
    }

    /**
     * Trigger event and pass previous listener's return value into next listener and return last result
     * @param name Event name
     * @param [...args]
     */
    pipe<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): GetEventHandlerReturnValue<Id, K> | undefined {
        return this._trigger(name, args, TriggerReturnType.PIPE);
    }

    /**
     * Trigger event and pass previous listener's return value into next listener and return
     * last result as promise
     * @param name Event name
     * @param [...args]
     */
    resolvePipe<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Promise<GetEventHandlerReturnValue<Id, K> | undefined> {
        return this._trigger(name, args, TriggerReturnType.PIPE, true);
    }

    /**
     * Trigger event and return all results as is
     * @param name Event name
     * @param [...args]
     */
    raw<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): Array<GetEventHandlerReturnValue<Id, K>> {
        return this._trigger(name, args, TriggerReturnType.RAW);
    }

    /**
     * Trigger all listeners of the event, do not return anything
     * @param name
     * @param [...args]
     */
    trigger<K extends EventName<Id>>(
        name: K,
        ...args: GetEventArguments<Id, K>
    ): void {
        this._trigger(name, args, undefined, undefined);
    }

    _trigger<K extends EventName<Id>>(
        name: K,
        args: GetEventArguments<Id, K>,
        returnType:
            | TriggerReturnType.ALL
            | TriggerReturnType.CONCAT
            | TriggerReturnType.RAW,
        resolve?: false,
    ): Array<GetEventHandlerReturnValue<Id, K>>;

    _trigger<K extends EventName<Id>>(
        name: K,
        args: GetEventArguments<Id, K>,
        returnType:
            | TriggerReturnType.ALL
            | TriggerReturnType.CONCAT
            | TriggerReturnType.RAW,
        resolve: true,
    ): Promise<Array<GetEventHandlerReturnValue<Id, K>>>;

    _trigger<K extends EventName<Id>>(
        name: K,
        args: GetEventArguments<Id, K>,
        returnType:
            | TriggerReturnType.FIRST
            | TriggerReturnType.LAST
            | TriggerReturnType.FIRST_NON_EMPTY
            | TriggerReturnType.PIPE
            | TriggerReturnType.MERGE,
        resolve?: false,
    ): GetEventHandlerReturnValue<Id, K> | undefined;

    _trigger<K extends EventName<Id>>(
        name: K,
        args: GetEventArguments<Id, K>,
        returnType:
            | TriggerReturnType.FIRST
            | TriggerReturnType.LAST
            | TriggerReturnType.FIRST_NON_EMPTY
            | TriggerReturnType.PIPE
            | TriggerReturnType.MERGE,
        resolve: true,
    ): Promise<GetEventHandlerReturnValue<Id, K> | undefined>;

    _trigger<K extends EventName<Id>>(
        name: K,
        args: GetEventArguments<Id, K>,
        returnType:
            | TriggerReturnType.UNTIL_FALSE
            | TriggerReturnType.UNTIL_TRUE
            | undefined
            | null,
        resolve?: false,
    ): void;

    _trigger<K extends EventName<Id>>(
        name: K,
        args: GetEventArguments<Id, K>,
        returnType:
            | TriggerReturnType.UNTIL_FALSE
            | TriggerReturnType.UNTIL_TRUE
            | undefined
            | null,
        resolve: true,
    ): Promise<void>;

    _trigger<K extends EventName<Id>>(
        name: K,
        args?: GetEventArguments<Id, K>,
        returnType?: TriggerReturnType | null,
        resolve?: boolean,
    ): TriggerReturnValue<GetEventHandlerReturnValue<Id, K>> {
        if (this.interceptor) {
            if (
                this.interceptor(
                    name as string | symbol,
                    args || [],
                    returnType,
                    this._tags,
                ) !== true
            ) {
                return undefined;
            }
        }

        const events = this.events;
        let e: ObservableEvent;
        let result;

        if ((e = events[name])) {
            result =
                resolve === true
                    ? e.resolve(args || [], returnType, this._tags)
                    : e.trigger(args || [], returnType, this._tags);
        } else if (resolve === true) {
            result = Promise.resolve(undefined);
        }

        // trigger * event with current event name
        // as first argument
        if ((e = events['*'])) {
            e.trigger([name, ...(args || [])], null, this._tags);
            // resolve
            //     ? e.resolve([name, ...(args || [])], returnType, this._tags)
            //     : e.trigger([name, ...(args || [])], returnType, this._tags);
        }

        return result;
    }

    /**
     * Suspend an event. Suspended event will not call any listeners on trigger().
     * If withQueue=true, events will be triggered after resume()
     * @param name Event name
     * @param withQueue enable events queue
     */
    suspendEvent<K extends EventName<Id>>(name: K, withQueue: boolean = false) {
        const events = this.events;
        if (!events[name]) {
            events[name] = new ObservableEvent();
        }
        events[name].suspend(withQueue);
    }

    /**
     * Check if event was suspended
     * @param name Event name
     */
    isSuspended<K extends EventName<Id>>(name: K): boolean {
        const events = this.events;
        if (!events[name]) {
            return false;
        }
        return events[name].suspended;
    }

    /**
     * Check if event was suspended with queue
     * @param name Event name
     */
    isQueued<K extends EventName<Id>>(name: K): boolean {
        const events = this.events;
        if (!events[name]) {
            return false;
        }
        return events[name].queued;
    }

    /**
     * Check if event has queued calls
     * @param name Event name (optional)
     */
    hasQueue<K extends EventName<Id>>(name?: K): boolean {
        const events = this.events;
        if (name) {
            if (!events[name]) {
                return false;
            }
            return events[name].queue.length > 0;
        } else {
            let found = false;
            for (const name in events) {
                if (events[name].queue.length > 0) {
                    found = true;
                    break;
                }
            }
            return found;
        }
    }

    /**
     * Suspend all events. Suspended event will not call any listeners on trigger().
     * If withQueue=true, events will be triggered after resume()
     * @param withQueue enable events queue
     */
    suspendAllEvents(withQueue: boolean = false) {
        const events = this.events;
        for (const name in events) {
            events[name].suspend(withQueue);
        }
    }

    /**
     * Resume suspended event.
     * @param name Event name
     */
    resumeEvent<K extends EventName<Id>>(name: K) {
        if (!this.events[name]) {
            return;
        }
        this.events[name].resume();
    }

    resumeAllEvents() {
        const events = this.events;
        for (const name in events) {
            events[name].resume();
        }
    }

    /**
     * @param name Event name
     */
    destroyEvent<K extends EventName<Id>>(name: K) {
        const events = this.events;
        if (events[name]) {
            events[name].removeAllListeners();
            events[name].$destroy();
            delete events[name];
        }
    }

    getPublicApi(): ObservablePubliApi<Id> {
        if (this.publicApi === null) {
            this.publicApi = {
                on: this.on.bind(this),
                un: this.un.bind(this),
                once: this.once.bind(this),
                has: this.has.bind(this),
            };
        }
        return this.publicApi;
    }

    /**
     * Destroy observable
     */
    $destroy() {
        const events = this.events;
        const eventSources = this.eventSources;

        eventSources.forEach((ev) => this.removeEventSource(ev));

        for (const name in events) {
            this.destroyEvent(name);
        }

        this.events = {} as EventStore<Id>;
        this.external = {};
        this.eventSources = [];
        this.publicApi = null;
    }
}
