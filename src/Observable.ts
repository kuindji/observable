import ObservableEvent from './ObservableEvent';
import {
    ObservablePubliApi,
    TriggerReturnType,
    ListenerFunction,
    TriggerReturnValue,
    EventSource,
    ProxyType,
    ProxyListener,
    InterceptorFunction,
    WithTagCallback,
    EventMap,
    ReturnableProxyType,
    MapKey,
    BaseMap,
    NormalizeEventMap,
    ConstructSingleMap,
    DefaultArgumentsType,
    EventOptions,
} from './types';

type EventStore<Map extends BaseMap> = {
    [K in keyof Map]: ObservableEvent<Map, K>;
};

type ProxyListenerMap = {
    [key: string]: ProxyListener;
};

export type InferObservableType<
    O extends Observable,
    Id extends MapKey | BaseMap = O extends Observable<
        infer Id extends MapKey | BaseMap
    >
        ? Id
        : any,
    Map extends BaseMap = O extends Observable<any, infer Map> ? Map : any,
> = {
    Id: Id;
    EventsMap: Map;
    Type: Observable<Id, Map>;
};

/**
 * A javascript event bus implementing multiple patterns:
 * observable, collector and pipe.
 * @author Ivan Kuindzhi
 */
export default class Observable<
    IdOrMap extends MapKey | BaseMap = BaseMap,
    Map extends BaseMap = NormalizeEventMap<
        ConstructSingleMap<IdOrMap, EventMap, any>
    >,
> {
    private events: EventStore<Map>;
    external: ProxyListenerMap;
    eventSources: EventSource[];
    publicApi: ObservablePubliApi<Map> | null = null;
    interceptor: InterceptorFunction | null = null;
    _tags?: string[] | null = null;

    constructor() {
        this.events = {} as EventStore<Map>;
        this.external = {};
        this.eventSources = [];
    }

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
    createEvent<E extends MapKey>(
        name: E,
        options: EventOptions<BaseMap, MapKey>,
    ): void {
        this.setEventOptions(name, options);
    }

    /**
     * Use this method only if you need to provide event-level options or listener argument types.
     * @param name Event name
     * @param options Event options
     */
    setEventOptions<E extends MapKey>(
        name: E,
        options: EventOptions<BaseMap, MapKey>,
    ): void {
        if (!this.events[name]) {
            this.events[name] = new ObservableEvent<Map, E>(options);
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
    on<E extends MapKey & keyof Map>(
        name: E,
        fn: Map[E]['handler'],
        options?: Map[E]['listenerOptions'],
    ): void {
        if (this.eventSources.length > 0) {
            this.eventSources.forEach((evs: EventSource) => {
                if (
                    evs.accepts === false ||
                    (typeof evs.accepts === 'function' && !evs.accepts(name))
                ) {
                    return;
                }
                if (evs.subscribed.indexOf(name) === -1) {
                    evs.on(name, this.proxy(name, evs.proxyType), evs, options);
                    evs.subscribed.push(name);
                }
            });
        }

        if (!this.events[name]) {
            this.events[name] = new ObservableEvent<Map, E>();
        }
        this.events[name].on(fn, options);
    }

    /**
     * Same as <code>on()</code>, but options.limit is forcefully set to 1.
     * @param name Event name
     * @param fn Listener
     * @param options? listener options
     */
    once<E extends MapKey & keyof Map>(
        name: E,
        fn: Map[E]['handler'],
        options?: Map[E]['listenerOptions'],
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
    promise<E extends MapKey & keyof Map>(
        name: E,
        options?: Map[E]['listenerOptions'],
    ): Promise<Map[E]['handlerArguments']> {
        return new Promise((resolve) => {
            this.once(
                name,
                (...args: Map[E]['handlerArguments']): any => {
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
    un<E extends MapKey & keyof Map>(
        name: E,
        fn: Map[E]['handler'],
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
        O extends Observable,
        SourceE extends MapKey,
        ExternalId extends MapKey | BaseMap = O extends Observable<
            infer Id_,
            infer Map_
        >
            ? Id_
            : any,
        ExternalMap extends BaseMap = O extends Observable<
            infer Id_,
            infer Map_
        >
            ? Map_
            : any,
    >(
        eventSource: O,
        eventName: MapKey,
        triggerName?: MapKey,
        triggerNamePfx?: string | null,
        proxyType: ProxyType = ProxyType.TRIGGER,
    ) {
        if (eventName === '*') {
            const l = this[proxyType] as unknown as ListenerFunction<
                ExternalMap[SourceE]['handlerArguments'],
                ExternalMap[SourceE]['handlerReturnType']
            >;
            (eventSource as unknown as Observable<ExternalId, ExternalMap>).on(
                '*' as SourceE,
                l,
                {
                    context: this,
                    replaceArgs: (
                        l: ExternalMap[SourceE]['listener'],
                        args: ExternalMap[SourceE]['triggerArguments'],
                    ): ExternalMap[SourceE]['handlerArguments'] => {
                        if (triggerNamePfx) {
                            args[0] = triggerNamePfx + args[0];
                        }
                        return args as ExternalMap[SourceE]['handlerArguments'];
                    },
                },
            );
        } else {
            const l = this[proxyType] as ListenerFunction<any[], any>;
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
        O extends Observable,
        SourceE extends MapKey,
        ExternalId extends MapKey | BaseMap = O extends Observable<
            infer Id_,
            infer Map_
        >
            ? Id_
            : any,
        ExternalMap extends BaseMap = O extends Observable<
            infer Id_,
            infer Map_
        >
            ? Map_
            : any,
    >(
        eventSource: O,
        eventName: SourceE,
        proxyType: ProxyType = ProxyType.TRIGGER,
    ) {
        const l = this[proxyType] as unknown as ListenerFunction<
            ExternalMap[SourceE]['handlerArguments'],
            ExternalMap[SourceE]['handlerReturnType']
        >;
        (eventSource as unknown as Observable<ExternalId, ExternalMap>).un(
            eventName,
            l,
            this,
        );
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
    hasEventSource(name: MapKey | EventSource): boolean {
        const inx = this.eventSources.findIndex((evs) =>
            typeof name === 'string' ||
            typeof name === 'symbol' ||
            typeof name === 'number'
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
    proxy<
        E extends MapKey & keyof Map,
        ArgsType extends DefaultArgumentsType = Map[E]['triggerArguments'],
    >(
        name: E,
        proxyType?: ProxyType,
    ): ProxyListener<
        Map[E]['triggerArguments'],
        | Map[E]['handlerReturnType']
        | Promise<Map[E]['handlerReturnType'] | undefined>
        | Array<Map[E]['handlerReturnType']>
        | Promise<Array<Map[E]['handlerReturnType']>>
        | undefined
    > {
        const key = (name as string) + '-' + (proxyType || ProxyType.TRIGGER);
        if (!this.external[key]) {
            this.external[key] = (...args: ArgsType) => {
                if (
                    proxyType !== undefined &&
                    proxyType !== null &&
                    proxyType !== ProxyType.TRIGGER &&
                    proxyType !== ProxyType.UNTIL_FALSE &&
                    proxyType !== ProxyType.UNTIL_TRUE
                ) {
                    const fn =
                        this[proxyType as ReturnableProxyType].bind(this);

                    return fn(name, ...args);
                } else {
                    this[proxyType || ProxyType.TRIGGER].apply(this, [
                        name,
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
    has<E extends MapKey & keyof Map>(
        name?: E,
        fn?: Map[E]['handler'] | null,
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
    hasListener<E extends MapKey & keyof Map>(
        name?: E,
        fn?: Map[E]['handler'] | null,
        context?: object | null,
        tag?: string,
    ): boolean {
        return this.has(name, fn, context, tag);
    }

    /**
     * Remove all listeners from specific event or from all events
     * @param name Event name
     */
    removeAllListeners(name?: MapKey, tag?: string) {
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
    all<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Array<Map[E]['handlerReturnType']> {
        return this._trigger(name, args, TriggerReturnType.ALL);
    }

    /**
     * Trigger event and return a promise with results from the listeners
     * @param name Event name
     * @param [...args]
     */
    resolveAll<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Array<Map[E]['handlerReturnType']>> {
        return this._trigger(name, args, TriggerReturnType.ALL, true);
    }

    /**
     * Trigger first event's listener and return its result
     * @param name Event name
     * @param [...args]
     */
    first<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Map[E]['handlerReturnType'] | undefined {
        return this._trigger(name, args, TriggerReturnType.FIRST);
    }

    /**
     * Trigger first event's listener and return its result as a promise
     * @param name Event name
     * @param [...args]
     */
    resolveFirst<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Map[E]['handlerReturnType'] | undefined> {
        return this._trigger(name, args, TriggerReturnType.FIRST, true);
    }

    /**
     * Trigger event and return last listener's result
     * @param name Event name
     * @param [...args]
     */
    last<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Map[E]['handlerReturnType'] | undefined {
        return this._trigger(name, args, TriggerReturnType.LAST);
    }

    /**
     * Trigger event and return last listener's result as a promise
     * @param name Event name
     * @param [...args]
     */
    resolveLast<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Map[E]['handlerReturnType'] | undefined> {
        return this._trigger(name, args, TriggerReturnType.LAST, true);
    }

    /**
     * Trigger event and return all results from the listeners merged into one object
     * @param name Event name
     * @param [...args]
     */
    merge<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Map[E]['handlerReturnType'] | undefined {
        return this._trigger(name, args, TriggerReturnType.MERGE);
    }

    /**
     * Trigger event and return as a promise all results from the listeners merged into one object
     * @param name Event name
     * @param [...args]
     */
    resolveMerge<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Map[E]['handlerReturnType'] | undefined> {
        return this._trigger(name, args, TriggerReturnType.MERGE, true);
    }

    /**
     * Trigger event and return all results from the listeners flattened into one array
     * @param name Event name
     * @param [...args]
     */
    concat<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Array<Map[E]['handlerReturnType']> {
        return this._trigger(name, args, TriggerReturnType.CONCAT);
    }

    /**
     * Trigger event and return as a promise all results from the listeners flattened into one array
     * @param name Event name
     * @param [...args]
     */
    resolveConcat<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Array<Map[E]['handlerReturnType']>> {
        return this._trigger(name, args, TriggerReturnType.CONCAT, true);
    }

    /**
     * Trigger event and return first non-empty listener result and skip others
     * @param name Event name
     * @param [...args]
     */
    firstNonEmpty<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Map[E]['handlerReturnType'] | undefined {
        return this._trigger(name, args, TriggerReturnType.FIRST_NON_EMPTY);
    }

    /**
     * Trigger event and return as a promise first non-empty listener result and skip others
     * @param name Event name
     * @param [...args]
     */
    resolveFirstNonEmpty<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Map[E]['handlerReturnType'] | undefined> {
        return this._trigger(
            name,
            args,
            TriggerReturnType.FIRST_NON_EMPTY,
            true,
        );
    }

    /**
     * Trigger event and return after first listener result that equals true and skip others
     * @param name Event name
     * @param [...args]
     */
    untilTrue<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): void {
        this._trigger(name, args, TriggerReturnType.UNTIL_TRUE);
    }

    /**
     * Trigger event and return after first listener result that equals false and skip others
     * @param name Event name
     * @param [...args]
     */
    untilFalse<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): void {
        this._trigger(name, args, TriggerReturnType.UNTIL_FALSE);
    }

    /**
     * Trigger event and pass previous listener's return value into next listener and return last result
     * @param name Event name
     * @param [...args]
     */
    pipe<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Map[E]['handlerReturnType'] | undefined {
        return this._trigger(name, args, TriggerReturnType.PIPE);
    }

    /**
     * Trigger event and pass previous listener's return value into next listener and return
     * last result as promise
     * @param name Event name
     * @param [...args]
     */
    resolvePipe<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Promise<Map[E]['handlerReturnType'] | undefined> {
        return this._trigger(name, args, TriggerReturnType.PIPE, true);
    }

    /**
     * Trigger event and return all results as is
     * @param name Event name
     * @param [...args]
     */
    raw<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): Array<Map[E]['handlerReturnType']> {
        return this._trigger(name, args, TriggerReturnType.RAW);
    }

    /**
     * Trigger all listeners of the event, do not return anything
     * @param name
     * @param [...args]
     */
    trigger<E extends MapKey & keyof Map>(
        name: E,
        ...args: Map[E]['triggerArguments']
    ): void {
        this._trigger(name, args, undefined, undefined);
    }

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType:
            | TriggerReturnType.ALL
            | TriggerReturnType.CONCAT
            | TriggerReturnType.RAW,
        resolve?: false,
    ): Array<Map[E]['handlerReturnType']>;

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType:
            | TriggerReturnType.ALL
            | TriggerReturnType.CONCAT
            | TriggerReturnType.RAW,
        resolve: true,
    ): Promise<Array<Map[E]['handlerReturnType']>>;

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType:
            | TriggerReturnType.FIRST
            | TriggerReturnType.LAST
            | TriggerReturnType.FIRST_NON_EMPTY
            | TriggerReturnType.PIPE
            | TriggerReturnType.MERGE,
        resolve?: false,
    ): Map[E]['handlerReturnType'] | undefined;

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType:
            | TriggerReturnType.FIRST
            | TriggerReturnType.LAST
            | TriggerReturnType.FIRST_NON_EMPTY
            | TriggerReturnType.PIPE
            | TriggerReturnType.MERGE,
        resolve: true,
    ): Promise<Map[E]['handlerReturnType'] | undefined>;

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType:
            | TriggerReturnType.UNTIL_FALSE
            | TriggerReturnType.UNTIL_TRUE
            | undefined
            | null,
        resolve?: false,
    ): undefined;

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType:
            | TriggerReturnType.UNTIL_FALSE
            | TriggerReturnType.UNTIL_TRUE
            | undefined
            | null,
        resolve: true,
    ): Promise<undefined>;

    _trigger<E extends MapKey & keyof Map>(
        name: E,
        args: Map[E]['triggerArguments'],
        returnType?: TriggerReturnType | null,
        resolve?: boolean,
    ):
        | TriggerReturnValue<Map[E]['handlerReturnType']>
        | Promise<TriggerReturnValue<Map[E]['handlerReturnType']>> {
        if (this.interceptor) {
            if (
                this.interceptor(
                    name as MapKey,
                    args || [],
                    returnType,
                    this._tags,
                ) !== true
            ) {
                return undefined;
            }
        }

        const events = this.events;
        let e: ObservableEvent<Map, E>;
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
        let asterisk;
        if ((asterisk = events['*'] as ObservableEvent<Map, '*'>)) {
            asterisk.trigger(
                [name, ...(args || [])] as Map['*']['triggerArguments'],
                null,
                this._tags,
            );
        }

        return result;
    }

    /**
     * Suspend an event. Suspended event will not call any listeners on trigger().
     * If withQueue=true, events will be triggered after resume()
     * @param name Event name
     * @param withQueue enable events queue
     */
    suspendEvent<E extends MapKey & keyof Map>(
        name: E,
        withQueue: boolean = false,
    ) {
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
    isSuspended<E extends MapKey & keyof Map>(name: E): boolean {
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
    isQueued<E extends MapKey & keyof Map>(name: E): boolean {
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
    hasQueue<E extends MapKey & keyof Map>(name?: E): boolean {
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
    resumeEvent<E extends MapKey & keyof Map>(name: E) {
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
    destroyEvent<E extends MapKey & keyof Map>(name: E) {
        const events = this.events;
        if (events[name]) {
            events[name].removeAllListeners();
            events[name].$destroy();
            delete events[name];
        }
    }

    getPublicApi(): ObservablePubliApi<Map> {
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

        this.events = {} as EventStore<Map>;
        this.external = {};
        this.eventSources = [];
        this.publicApi = null;
    }
}
