export type MapKey = string | number | symbol;
export interface BaseMap {
    [key: MapKey]: any;
}

// type CommonKeys<T extends object> = keyof T;
// type AllKeys<T> = T extends any ? keyof T : never;
// type Subtract<A, C> = A extends C ? never : A;
// type NonCommonKeys<T extends object> = Subtract<AllKeys<T>, CommonKeys<T>>;
// type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
//     ? T[K]
//     : undefined;
// export type Merge<T extends object> = {
//     [k in NonCommonKeys<T>]: Exclude<PickType<T, k>, undefined>;
// };
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
    x: infer I,
) => void
    ? I
    : never;
type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true;

type _Merge<
    T,
    K extends PropertyKey = T extends unknown ? keyof T : never,
> = T extends unknown ? T & Record<Exclude<K, keyof T>, never> : never;

export type Merge<T> = { [K in keyof _Merge<T>]: _Merge<T>[K] };

export type ConstructSingleMap<
    IdOrMap extends MapKey | object = never,
    MapSource extends { [key: MapKey]: object } = {},
    DefaultMap extends any = never,
    IsIdOrMapUnion extends boolean = IsUnion<IdOrMap>,
    SingleObject extends object = [IsIdOrMapUnion] extends [false]
        ? [IdOrMap] extends [object]
            ? IdOrMap
            : never
        : never,
    MapKeys extends MapKey = Exclude<IdOrMap, object>,
    Objects extends object = Exclude<IdOrMap, MapKey>,
    IsMapKeyUnion extends boolean = IsUnion<MapKeys>,
    IsObjectUnion extends boolean = IsUnion<Objects>,
    IsOnlyMapKeys extends boolean = [Objects] extends [never]
        ? [MapKeys] extends [never]
            ? false
            : true
        : false,
    IsOnlyObjects extends boolean = [MapKeys] extends [never]
        ? [Objects] extends [never]
            ? false
            : true
        : false,
    IsEmpty extends boolean = [MapKeys] extends [never]
        ? [Objects] extends [never]
            ? true
            : false
        : false,
    IsMixed extends boolean = [IsEmpty] extends [true]
        ? false
        : [IsOnlyMapKeys] extends [true]
        ? false
        : [IsOnlyObjects] extends [true]
        ? false
        : true,
    MapKeysData extends object = [IsMapKeyUnion] extends [true]
        ? Merge<MapSource[MapKeys & keyof MapSource]>
        : MapSource[MapKeys & keyof MapSource],
    ObjectsData extends object = [IsObjectUnion] extends [true]
        ? Merge<Objects>
        : Objects,
> = [SingleObject] extends [never]
    ? [IsEmpty] extends [true]
        ? DefaultMap
        : [IsMixed] extends [true]
        ? Merge<MapKeysData | ObjectsData>
        : [IsOnlyMapKeys] extends [true]
        ? MapKeysData
        : [IsOnlyObjects] extends [true]
        ? ObjectsData
        : DefaultMap
    : SingleObject;

export type DefaultArgumentsType = any[];
export type DefaultReturnType = any;
export type DefaultHandler = (
    ...args: DefaultArgumentsType
) => DefaultReturnType;

// export type GenericEventArguments = any[];
// export type GenericEventHandlerReturnValue = any;

export interface EventType {
    triggerArguments: DefaultArgumentsType;
    handlerArguments: DefaultArgumentsType;
    handlerReturnType: DefaultReturnType;
}

export type EventDefinition<
    P extends DefaultArgumentsType = DefaultArgumentsType,
    R = DefaultReturnType,
    O extends DefaultArgumentsType = P,
> = {
    triggerArguments: P;
    handlerArguments: O;
    handlerReturnType: R;
};

export type EventMapDefinition<M extends object> = Merge<
    | {
          '*': EventDefinition<any[], any, [MapKey, ...any[]]>;
      }
    | M
>;

export interface EventMap {
    [key: MapKey]: {
        [key: MapKey]: object;
    };
}

export type GetFirstKnownArgument<
    T1 extends Array<any>,
    T2 extends Array<any>,
    T3 extends Array<any>,
> = [unknown] extends [T1] ? ([unknown] extends [T2] ? T3 : T2) : T1;

export type ConstructHandlerFromMap<
    Map extends BaseMap = any,
    E extends MapKey & keyof Map = any,
    Args extends DefaultArgumentsType = [Map[E]] extends [
        {
            triggerArguments?: infer TArgs extends Array<any>;
            handlerArguments?: infer HArgs extends Array<any>;
        },
    ]
        ? GetFirstKnownArgument<HArgs, TArgs, DefaultArgumentsType>
        : DefaultArgumentsType,
    Ret extends DefaultReturnType = [Map[E]] extends [
        {
            handlerReturnType?: infer Ret;
        },
    ]
        ? Ret
        : DefaultReturnType,
> = (...args: Args) => Ret;

export type GetHandlerArgumentsFromMap<
    Map extends BaseMap = any,
    E extends keyof Map = any,
> = [Map[E]] extends [
    {
        triggerArguments?: infer TArgs extends Array<any>;
        handlerArguments?: infer HArgs extends Array<any>;
    },
]
    ? GetFirstKnownArgument<HArgs, TArgs, DefaultArgumentsType>
    : DefaultArgumentsType;

export type GetTriggerArgumentsFromMap<
    Map extends BaseMap = any,
    E extends keyof Map = any,
> = [Map[E]] extends [
    {
        triggerArguments?: infer TArgs extends Array<any>;
    },
]
    ? [unknown] extends [TArgs]
        ? DefaultArgumentsType
        : TArgs
    : DefaultArgumentsType;

export type GetHandlerReturnTypeFromMap<
    Map extends BaseMap = any,
    E extends keyof Map = any,
> = [Map[E]] extends [
    {
        handlerReturnType?: infer Ret;
    },
]
    ? Ret
    : DefaultReturnType;

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

export type TriggerFilter<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap,
> = (
    params: GetHandlerArgumentsFromMap<EventsMap, E>,
    listener?: any, //Listener<EventsMap, E>,
) => boolean;

export type ListenerFunction<
    P extends DefaultArgumentsType,
    R = DefaultReturnType,
> = (...args: P) => R;

export type ArgumentsPrependTransformer<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap,
> =
    | GetHandlerArgumentsFromMap<EventsMap, E>
    | ((
          listener: Listener<EventsMap, E>,
          args: GetTriggerArgumentsFromMap<EventsMap, E>,
      ) => GetHandlerArgumentsFromMap<EventsMap, E>);

export type ArgumentsAppendTransformer<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap,
> =
    | GetHandlerArgumentsFromMap<EventsMap, E>
    | ((
          listener: Listener<EventsMap, E>,
          args: GetTriggerArgumentsFromMap<EventsMap, E>,
      ) => GetHandlerArgumentsFromMap<EventsMap, E>);

export type ArgumentsTransformer<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap,
> =
    | GetHandlerArgumentsFromMap<EventsMap, E>
    | ((
          listener: Listener<EventsMap, E>,
          args: GetTriggerArgumentsFromMap<EventsMap, E>,
      ) => GetHandlerArgumentsFromMap<EventsMap, E>);

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
    P extends Array<any> = DefaultArgumentsType,
    R = DefaultReturnType,
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

type BaseEventOptions<EventsMap extends BaseMap, E extends MapKey> = {
    /**
     * A function that decides whether event should trigger a listener this time
     */
    filter?: TriggerFilter<EventsMap, E>;
    /**
     * TriggerFilter's this object, if needed
     */
    filterContext?: object;
    /**
     * Append parameters
     */
    appendArgs?: ArgumentsAppendTransformer<EventsMap, E>;
    /**
     * Prepend parameters
     */
    prependArgs?: ArgumentsPrependTransformer<EventsMap, E>;
    /**
     * Replace parameters
     */
    replaceArgs?: ArgumentsTransformer<EventsMap, E>;
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
    EventsMap extends BaseMap,
    E extends MapKey,
> = BaseEventOptions<EventsMap, E> & {
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
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap,
> = BaseEventOptions<EventsMap, E> & {
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
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap,
    FnType extends DefaultHandler = ConstructHandlerFromMap<EventsMap, E>,
> = ListenerOptions<EventsMap, E> & {
    fn: FnType;
    called: number;
    count: number;
    index: number;
};

export type NormalizeEventMap<EventsMap extends BaseMap> = {
    [E in keyof EventsMap]: {
        triggerArguments: GetTriggerArgumentsFromMap<EventsMap, E> & Array<any>;
        handlerArguments: GetHandlerArgumentsFromMap<EventsMap, E> & Array<any>;
        handler: ConstructHandlerFromMap<EventsMap, E>;
        handlerReturnType: GetHandlerReturnTypeFromMap<EventsMap, E>;
        listener: Listener<EventsMap, E>;
        eventOptions: EventOptions<EventsMap, E>;
        listenerOptions: ListenerOptions<EventsMap, E>;
        triggerFilter: TriggerFilter<EventsMap, E>;
        prependTransformer: ArgumentsPrependTransformer<EventsMap, E>;
        appendTransformer: ArgumentsAppendTransformer<EventsMap, E>;
        replaceTransformer: ArgumentsTransformer<EventsMap, E>;
    };
};

export type ObservableApiOn<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap = any,
> = (
    name: E,
    fn: ConstructHandlerFromMap<EventsMap, E>,
    options?: ListenerOptions<EventsMap, E>,
) => void;

export type ObservableApiOnce<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap = any,
> = (
    name: E,
    fn: ConstructHandlerFromMap<EventsMap, E>,
    options?: ListenerOptions<EventsMap, E>,
) => void;

export type ObservableApiUn<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap = any,
> = (
    name: E,
    fn: ConstructHandlerFromMap<EventsMap, E>,
    context?: object,
) => void;

export type ObservableApiHas<
    EventsMap extends BaseMap,
    E extends MapKey & keyof EventsMap = any,
> = (
    name?: E,
    fn?: ConstructHandlerFromMap<EventsMap, E>,
    context?: object,
) => boolean;

export type ObservablePubliApi<EventsMap extends BaseMap> = {
    on: ObservableApiOn<EventsMap>;
    un: ObservableApiUn<EventsMap>;
    once: ObservableApiOnce<EventsMap>;
    has: ObservableApiHas<EventsMap>;
};
