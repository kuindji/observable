export type GenericEventArguments = any[];
export type GenericEventHandlerReturnValue = any;

export interface EventType {
    triggerArguments: GenericEventArguments;
    handlerArguments: GenericEventArguments;
    handlerReturnType: GenericEventHandlerReturnValue;
}

export type EventDefinition<
    P extends GenericEventArguments = GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = {
    triggerArguments: P;
    handlerArguments: O;
    handlerReturnType: R;
};

export type MapKey = string | number | symbol;

export type EventMapDefinition<M = Record<MapKey, EventType>> = {
    '*': EventDefinition<any[], any, [MapKey, ...any[]]>;
} & M;

export interface EventMap {
    [key: MapKey]: {
        [key: MapKey]: EventType;
    };
}

export type GetEventArguments<
    Id extends MapKey,
    E extends MapKey,
> = Id extends keyof EventMap
    ? E extends keyof EventMap[Id]
        ? [EventMap[Id][E]['triggerArguments']] extends [undefined]
            ? GenericEventArguments
            : EventMap[Id][E]['triggerArguments']
        : GenericEventArguments
    : GenericEventArguments;

export type GetEventHandlerReturnValue<
    Id extends MapKey,
    E extends MapKey,
> = Id extends keyof EventMap
    ? E extends keyof EventMap[Id]
        ? [EventMap[Id][E]['handlerReturnType']] extends [undefined]
            ? GenericEventHandlerReturnValue
            : EventMap[Id][E]['handlerReturnType']
        : GenericEventHandlerReturnValue
    : GenericEventHandlerReturnValue;

export type GetEventHandlerArguments<
    Id extends MapKey,
    E extends MapKey,
> = Id extends keyof EventMap
    ? E extends keyof EventMap[Id]
        ? [EventMap[Id][E]['handlerArguments']] extends [undefined]
            ? GetEventArguments<Id, E>
            : EventMap[Id][E]['handlerArguments']
        : GenericEventArguments
    : GenericEventArguments;

export enum TriggerReturnType {
    RAW = 'raw',
    ALL = 'all',
    CONCAT = 'concat',
    MERGE = 'merge',
    LAST = 'last',
    PIPE = 'pipe',
    FIRST = 'first',
    UNTIL_TRUE = 'true',
    UNTIL_FALSE = 'false',
    FIRST_NON_EMPTY = 'nonempty',
}

export type InterceptorFunction = (
    eventName: MapKey,
    params: any[],
    returnType: any,
    tags?: string[] | null,
) => boolean;

export type TriggerFilter<Id extends MapKey, E extends MapKey> = (
    params: GetEventHandlerArguments<Id, E>,
    listener?: Listener<Id, E>,
) => boolean;

export type ListenerFunction<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
> = (...args: P) => R;

export type ArgumentsPrependTransformer<Id extends MapKey, E extends MapKey> =
    | GetEventHandlerArguments<Id, E>
    | ((
          listener: Listener<Id, E>,
          args: GetEventArguments<Id, E>,
      ) => GetEventHandlerArguments<Id, E>);

export type ArgumentsAppendTransformer<Id extends MapKey, E extends MapKey> =
    | GetEventHandlerArguments<Id, E>
    | ((
          listener: Listener<Id, E>,
          args: GetEventArguments<Id, E>,
      ) => GetEventHandlerArguments<Id, E>);

export type ArgumentsTransformer<Id extends MapKey, E extends MapKey> =
    | GetEventHandlerArguments<Id, E>
    | ((
          listener: Listener<Id, E>,
          args: GetEventArguments<Id, E>,
      ) => GetEventHandlerArguments<Id, E>);

export type TriggerReturnValue<R = any> =
    | undefined
    | R
    | R[]
    | { [key: string]: R }
    | true
    | false
    | Promise<R | R[] | { [key: string]: R } | undefined | true | false>;

export type EventSourceSubscriber = (
    name: MapKey,
    fn: (...args: any[]) => any,
    eventSource: EventSource,
    options?: Record<string, any>,
) => void;

export type EventSourceUnsubscriber = (
    name: MapKey,
    fn: (...args: any[]) => any,
    eventSource: EventSource,
    tag?: string,
) => void;

export type EventSource = {
    name: MapKey;
    on: EventSourceSubscriber;
    un: EventSourceUnsubscriber;
    accepts: ((name: MapKey) => boolean) | boolean;
    proxyType?: ProxyType;
    [key: string]: any;
};

export type WithTagCallback = () => void;

export type ProxyListener<
    P extends Array<any> = GenericEventArguments,
    R = GenericEventHandlerReturnValue,
> = (...args: P) => R;

export enum ProxyType {
    TRIGGER = 'trigger',
    RAW = 'raw',
    ALL = 'all',
    CONCAT = 'concat',
    MERGE = 'merge',
    LAST = 'last',
    PIPE = 'pipe',
    FIRST = 'first',
    UNTIL_TRUE = 'untilTrue',
    UNTIL_FALSE = 'untilFalse',
    FIRST_NON_EMPTY = 'firstNonEmpty',
    RESOLVE_ALL = 'resolveAll',
    RESOLVE_MERGE = 'resolveMerge',
    RESOLVE_CONCAT = 'resolveConcat',
    RESOLVE_FIRST = 'resolveFirst',
    RESOLVE_FIRST_NON_EMPTY = 'resolveFirstNonEmpty',
    RESOLVE_LAST = 'resolveLast',
    RESOLVE_PIPE = 'resolvePipe',
}

export type ReturnableProxyType =
    | ProxyType.RESOLVE_ALL
    | ProxyType.RESOLVE_MERGE
    | ProxyType.RESOLVE_CONCAT
    | ProxyType.RESOLVE_FIRST
    | ProxyType.RESOLVE_LAST
    | ProxyType.RESOLVE_FIRST_NON_EMPTY
    | ProxyType.RESOLVE_PIPE
    | ProxyType.ALL
    | ProxyType.MERGE
    | ProxyType.FIRST
    | ProxyType.LAST
    | ProxyType.CONCAT
    | ProxyType.PIPE
    | ProxyType.RAW;

type BaseEventOptions<Id extends MapKey, E extends MapKey> = {
    /**
     * A function that decides whether event should trigger a listener this time
     */
    filter?: TriggerFilter<Id, E>;
    /**
     * TriggerFilter's this object, if needed
     */
    filterContext?: object;
    /**
     * Append parameters
     */
    appendArgs?: ArgumentsAppendTransformer<Id, E>;
    /**
     * Prepend parameters
     */
    prependArgs?: ArgumentsPrependTransformer<Id, E>;
    /**
     * Replace parameters
     */
    replaceArgs?: ArgumentsTransformer<Id, E>;
    /**
     * Call this listener asynchronously. If event was
     *  created with <code>expectPromises: true</code>,
     *  this option is ignored. Milliseconds or true|false
     */
    async?: boolean | number;
};

/**
 * Event options
 */
export type EventOptions<
    Id extends MapKey,
    E extends MapKey,
> = BaseEventOptions<Id, E> & {
    /**
     * once triggered, all future subscribers will be automatically called
     * with last trigger params
     */
    autoTrigger?: boolean;
    /**
     * Trigger event this number of times; 0 for unlimited
     * @default 0
     */
    limit?: number;
};

export type ListenerOptions<
    Id extends MapKey,
    E extends MapKey,
> = BaseEventOptions<Id, E> & {
    /**
     * True to prepend to the list of listeners
     * @default false
     */
    first?: boolean;
    /**
     * True to always run this listener before others
     * @default false
     */
    alwaysFirst?: boolean;
    /**
     * True to always run this listener after others
     * @default false
     */
    alwaysLast?: boolean;
    /**
     * Call handler this number of times; 0 for unlimited
     * @default 0
     */
    limit?: number;
    /**
     * Start calling listener after this number of calls. Starts from 1
     * @default 1
     */
    start?: number;
    /**
     * Listener's context (this) object
     */
    context?: object;
    /**
     * Listener tags
     */
    tags?: string[];
    /**
     * You can pass any additional fields here. They will be passed back to TriggerFilter
     */
    extraData?: any;
};

export type Listener<Id extends MapKey, E extends MapKey> = ListenerOptions<
    Id,
    E
> & {
    fn: ListenerFunction<
        GetEventHandlerArguments<Id, E>,
        GetEventHandlerReturnValue<Id, E>
    >;
    called: number;
    count: number;
    index: number;
};

export type ObservableApiOn<Id extends MapKey, E extends MapKey = any> = (
    name: E,
    fn: ListenerFunction<
        GetEventHandlerArguments<Id, E>,
        GetEventHandlerReturnValue<Id, E>
    >,
    options?: ListenerOptions<Id, E>,
) => void;

export type ObservableApiOnce<Id extends MapKey, E extends MapKey = any> = (
    name: E,
    fn: ListenerFunction<
        GetEventHandlerArguments<Id, E>,
        GetEventHandlerReturnValue<Id, E>
    >,
    options?: ListenerOptions<Id, E>,
) => void;

export type ObservableApiUn<Id extends MapKey, E extends MapKey = any> = (
    name: E,
    fn: ListenerFunction<
        GetEventHandlerArguments<Id, E>,
        GetEventHandlerReturnValue<Id, E>
    >,
    context?: object,
) => void;

export type ObservableApiHas<Id extends MapKey, E extends MapKey = any> = (
    name?: E,
    fn?: ListenerFunction<
        GetEventHandlerArguments<Id, E>,
        GetEventHandlerReturnValue<Id, E>
    >,
    context?: object,
) => boolean;

export type ObservablePubliApi<Id extends MapKey> = {
    on: ObservableApiOn<Id>;
    un: ObservableApiUn<Id>;
    once: ObservableApiOnce<Id>;
    has: ObservableApiHas<Id>;
};
