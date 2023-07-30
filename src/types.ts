
export enum ReturnType {
    RAW = "raw",
    ALL = "all",
    CONCAT = "concat",
    MERGE = "merge",
    LAST = "last",
    PIPE = "pipe",
    FIRST = "first",
    FIRST_FALSE = "first_true",
    FIRST_TRUE = "first_false",
    FIRST_NON_EMPTY = "nonempty"
}

export type TriggerFilter = (params: any[], listener?: Listener) => boolean;

export type ListenerFunction = (...args: any) => any;

export type ArgumetsTransformer = any[] | ((listener: Listener, args: any[]) => any[]);

export type ReturnValue = undefined | any | any[] | { [key: string] : any } |
                            Promise<any> |
                            Promise<any[]> |
                            Promise<{ [key: string] : any }>;

type BaseEventOptions = {

    /**
     * A function that decides whether event should trigger a listener this time
     */
    filter?: TriggerFilter,
    /**
     * TriggerFilter's this object, if needed
     */
    filterContext?: object,
    /**
     * Append parameters
     */
    appendArgs?: ArgumetsTransformer,
    /**
     * Prepend parameters
     */
    prependArgs?: ArgumetsTransformer,
    /**
     * Replace parameters
     */
    replaceArgs?: ArgumetsTransformer,
    /**
     * Call this listener asynchronously. If event was
     *  created with <code>expectPromises: true</code>, 
     *  this option is ignored. Milliseconds or true|false
     */
    async?: boolean | number,

};

/**
 * Event options
 */
export type EventOptions = BaseEventOptions & {
    /**
     * once triggered, all future subscribers will be automatically called
     * with last trigger params
     * @example src-docs/examples/autoTrigger.js
     */
    autoTrigger?: boolean,
    /**
     * Trigger event this number of times; 0 for unlimited
     * @default 0
     */
    limit?: number
}


export type ListenerOptions = BaseEventOptions & {
    /**
     * True to prepend to the list of listeners
     * @default false
     */
    first?: boolean,
    /**
     * True to always run this listener before others
     * @default false
     */
    alwaysFirst?: boolean,
    /**
     * True to always run this listener after others
     * @default false
     */
    alwaysLast?: boolean,
    /**
     * Call handler this number of times; 0 for unlimited
     * @default 0
     */
    limit?: number,
    /**
     * Start calling listener after this number of calls. Starts from 1
     * @default 1
     */
    start?: number,
    /**
     * Listener's context (this) object
     */
    context?: object,
    /**
     * You can pass any additional fields here. They will be passed back to TriggerFilter
     */
    extraData?: any
}


export type Listener = ListenerOptions & {
    fn: ListenerFunction,
    called: number,
    count: number,
    index: number
}