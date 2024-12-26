export type GenericEventArguments = Array<any>;
export type GenericEventHandlerReturnValue = any;

export interface EventType {
    eventArguments: GenericEventArguments;
    handlerArguments: GenericEventArguments;
    handlerReturnType: GenericEventHandlerReturnValue;
}

export type EventDefinition<
    P = GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O = P,
> = {
    eventArguments: P;
    handlerArguments: O;
    handlerReturnType: R;
};

export interface EventMap {
    [key: symbol]: {
        [key: string | symbol]: EventType;
    };
}

export type EventName<Id extends symbol> = string | symbol | keyof EventMap[Id];

export type GetEventArguments<
    Id extends symbol,
    K extends keyof EventMap[Id],
> = [K] extends [keyof EventMap[Id]]
    ? EventMap[Id][K]['eventArguments']
    : GenericEventArguments;

export type GetEventHandlerReturnValue<
    Id extends symbol,
    K extends keyof EventMap[Id],
> = [K] extends [keyof EventMap[Id]]
    ? [EventMap[Id][K]['handlerReturnType']] extends [undefined]
        ? GenericEventHandlerReturnValue
        : EventMap[Id][K]['handlerReturnType']
    : GenericEventHandlerReturnValue;

export type GetEventHandlerArguments<
    Id extends symbol,
    K extends keyof EventMap[Id],
> = [K] extends [keyof EventMap[Id]]
    ? [EventMap[Id][K]['handlerArguments']] extends [undefined]
        ? GetEventArguments<Id, K>
        : EventMap[Id][K]['handlerArguments']
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
    eventName: string | symbol,
    params: any[],
    returnType: any,
    tags?: string[] | null,
) => boolean;

export type TriggerFilter<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = (params: O, listener?: Listener<P, R, O>) => boolean;

export type ListenerFunction<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
> = (...args: P) => R;

export type ArgumentsPrependTransformer<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = any[] | ((listener: Listener<P, R, O>, args: P) => any[]);

export type ArgumentsAppendTransformer<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = any[] | ((listener: Listener<P, R, O>, args: P) => any[]);

export type ArgumentsTransformer<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = O | ((listener: Listener<P, R, O>, args: P) => O);

export type TriggerReturnValue<R = any> =
    | undefined
    | R
    | R[]
    | { [key: string]: R }
    | Promise<R>
    | Promise<R[]>
    | Promise<{ [key: string]: R }>
    | boolean;

export type EventSourceSubscriber = (
    name: string | symbol,
    fn: (...args: any[]) => any,
    eventSource: EventSource,
    options?: ListenerOptions<any[], any>,
) => void;

export type EventSourceUnsubscriber = (
    name: string | symbol,
    fn: (...args: any[]) => any,
    eventSource: EventSource,
    tag?: string,
) => void;

export type EventSource = {
    name: string | symbol;
    on: EventSourceSubscriber;
    un: EventSourceUnsubscriber;
    accepts: ((name: string | symbol) => boolean) | boolean;
    proxyType?: ProxyType;
    [key: string]: any;
};

export type WithTagCallback = () => void;

export type ProxyListener = (...args: any) => any | void;

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

type BaseEventOptions<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = {
    /**
     * A function that decides whether event should trigger a listener this time
     */
    filter?: TriggerFilter<P, R, O>;
    /**
     * TriggerFilter's this object, if needed
     */
    filterContext?: object;
    /**
     * Append parameters
     */
    appendArgs?: ArgumentsAppendTransformer<P, R, O>;
    /**
     * Prepend parameters
     */
    prependArgs?: ArgumentsPrependTransformer<P, R, O>;
    /**
     * Replace parameters
     */
    replaceArgs?: ArgumentsTransformer<P, R, O>;
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
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = BaseEventOptions<P, R, O> & {
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
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = BaseEventOptions<P, R, O> & {
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

export type Listener<
    P extends GenericEventArguments,
    R = GenericEventHandlerReturnValue,
    O extends GenericEventArguments = P,
> = ListenerOptions<P, R, O> & {
    fn: ListenerFunction<O, R>;
    called: number;
    count: number;
    index: number;
};

export type ObservableApiOn<
    Id extends symbol,
    K extends keyof EventMap[Id] = string,
> = (
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
) => void;

export type ObservableApiOnce<
    Id extends symbol,
    K extends keyof EventMap[Id] = string,
> = (
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
) => void;

export type ObservableApiUn<
    Id extends symbol,
    K extends keyof EventMap[Id] = string,
> = (
    name: K,
    fn: ListenerFunction<
        GetEventHandlerArguments<Id, K>,
        GetEventHandlerReturnValue<Id, K>
    >,
    context?: object,
) => void;

export type ObservableApiHas<
    Id extends symbol,
    K extends keyof EventMap[Id] = string,
> = (
    name?: string,
    fn?: ListenerFunction<
        GetEventHandlerArguments<Id, K>,
        GetEventHandlerReturnValue<Id, K>
    >,
    context?: object,
) => boolean;

export type ObservablePubliApi<Id extends symbol> = {
    on: ObservableApiOn<Id>;
    un: ObservableApiUn<Id>;
    once: ObservableApiOnce<Id>;
    has: ObservableApiHas<Id>;
};
