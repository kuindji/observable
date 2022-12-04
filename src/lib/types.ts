
export type ListenerPublicInfo = {
    id: number,
    userData?: any
};

export type ReplaceArgsCallback = (
    args: any[],
    userData?: any
) => any[];

export type PrependArgsCallback = (
    args: any[],
    userData?: any
) => any[];

export type AppendArgsCallback = (
    args: any[],
    userData?: any
) => any[];

export type EventFilterCallback = (
    listener: ListenerPublicInfo,
    args?: any[]
) => boolean;

export type ListenerFilterCallback = (
    context?: any,
    ...args: any[]
) => boolean;


export type EventOptions = {
    returnResult?: string|boolean|null
    limit?: number
    autoTrigger?: boolean|null
    triggerFilter?: EventFilterCallback|null
    filterContext?: any
    expectPromises?:boolean
    keepPromiseOrder?:boolean
    resolvePromises?:boolean
};

export type Listener = {
    id: number
    fn: Function
    context: any
    append: AppendArgsCallback | any[] | null
    prepend: PrependArgsCallback | any[] | null
    replace: ReplaceArgsCallback | any[] | null
    filter: ListenerFilterCallback|null
    filterContext: any
    async: number
    limit: number
    called: number
    start: number
    count: number
    userData: any
}

export type ListenerOptions = {
    context?: any
    once?: boolean
    first?: boolean
    limit?: number
    start?: number
    append?: AppendArgsCallback | any[] | null
    prepend?: PrependArgsCallback | any[] | null
    replace?: ReplaceArgsCallback | any[] | null
    async?: boolean | number
    filter?: ListenerFilterCallback | null
    filterContext?: any
    userData?: any
}