import async from "./lib/async"
import isPromise from "./lib/isPromise"
import listenerSorter from "./lib/listenerSorter"
import { ReturnType } from "./types"
import { ListenerFunction, ListenerOptions, 
        Listener, TriggerFilter, ReturnValue,
        EventOptions, ArgumetsTransformer } from "./types"

function tagsIntersect(t1: string[], t2: string[]): boolean {
    for (const tag of t1) {
        if (t2.indexOf(tag) !== -1) {
            return true;
        }
    }
    return false;
}

/**
 * This class is private - you can't create an event other than via Observable.
 * @private
 */
export default class ObservableEvent {

    listeners: Listener[] = []
    queue: Array<[Array<any>, ReturnType | null]> = []
    suspended: boolean = false
    queued: boolean = false
    triggered: number = 0
    lastTrigger: any[] | null = null
    sortListeners: boolean = false

    async: boolean | number = false
    limit: number = 0
    autoTrigger: boolean | null = null
    filter: TriggerFilter | null = null
    filterContext: object | null = null
    appendArgs: ArgumetsTransformer | null = null
    prependArgs: ArgumetsTransformer | null = null
    replaceArgs: ArgumetsTransformer | null = null

    constructor(options?: EventOptions) {
        if (options) {
            Object.assign(this, options);
        }
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
    on(fn: ListenerFunction, options: ListenerOptions = {}): void {

        if (!fn) {
            return;
        }

        const listeners = this.listeners;

        if (listeners.find(l => l.fn === fn && l.context === options.context)) {
            return;
        }

        const listener: Listener = {
            fn:         fn,
            context:    undefined,
            async:      false,
            called:     0, // how many times the function was triggered
            limit:      0, // how many times the function is allowed to trigger
            start:      1, // from which attempt it is allowed to trigger the function
            count:      0, // how many attempts to trigger the function was made
            index:      0
        };

        Object.assign(listener, options);

        if (listener.async === true) {
            listener.async = 1;
        }
        if (options.first === true || options.alwaysFirst === true) {
            listeners.unshift(listener);
        }
        else {
            listeners.push(listener);
        }

        if (this.sortListeners) {
            this.listeners = listeners
                                .map((l: Listener, inx: number): Listener => {
                                    l.index = inx;
                                    return l;
                                })
                                .sort(listenerSorter);
        }

        if (options.alwaysFirst === true || options.alwaysLast === true) {
            this.sortListeners = true;
        }

        if (this.autoTrigger && this.lastTrigger && !this.suspended) {
            const prevFilter = this.filter;
            this.filter = (args: any[], l?: Listener) => {
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
    un(fn: ListenerFunction, context?: object | null, tag?: string): boolean {

        const listeners = this.listeners;
        const inx = listeners.findIndex(l => {
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
    hasListener(fn?: ListenerFunction | null, context?: object | null, tag?: string | null): boolean {
        if (fn) {
            return this.listeners.findIndex(l => {
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
            }) !== -1;
        }
        if (tag) {
            return this.listeners.findIndex(l => l.tags && l.tags.indexOf(tag) !== -1) !== -1;
        }
        else {
            return this.listeners.length > 0;
        }
    }

    removeAllListeners(tag?: string) {
        if (tag) {
            this.listeners = this.listeners.filter(l => {
                return !l.tags || l.tags.indexOf(tag) === -1;
            });
        }
        else {
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

    getFilterContext(l: Listener) {
        return l.filterContext || this.filterContext || l.context;
    }

    prepareArgs(l: Listener, triggerArgs: any[]): any[] {

        let args: any[] = triggerArgs;
        const append: ArgumetsTransformer | null = l.appendArgs || this.appendArgs || null, 
            prepend: ArgumetsTransformer | null = l.prependArgs || this.prependArgs || null, 
            repl: ArgumetsTransformer | null = l.replaceArgs || this.replaceArgs || null;
    
        if (append || prepend) {    
            if (prepend) {
                if (typeof prepend === "function") {
                    args = [ ...prepend(l, args), ...args ];
                }
                else {
                    args = [ ...prepend, ...args ];
                }
            }
            if (append) {
                if (typeof append === "function") {
                    args = [ ...args, ...append(l, args) ];
                }
                else {
                    args = [ ...args, ...append ];
                }
            }
        }
        else if (repl) {
            if (typeof repl === "function") {
                args = [ ...repl(l, args) ];
            }
            else {
                args = [ ...repl ];
            }
        }
    
        return args;
    }

    lcall(listener: Listener, args: any[], resolve: null | ((any: any) => void) = null): ReturnValue {
        const isAsync = listener.async !== false ? listener.async : this.async;
        const result = isAsync !== false ?
                        /* promise */ async(
                            listener.fn, 
                            listener.context, 
                            args, 
                            isAsync === true ? 0 : isAsync
                        ) :
                        /* value or promise */ listener.fn.apply(listener.context, args);
        if (resolve !== null) {
            resolve(result);
        }
        else {
            return result;
        }
    }

    lcallWPrev(listener: Listener, args: any[], prevValue: any, returnType: ReturnType): ReturnValue {
        if (returnType === ReturnType.PIPE) {
            args[0] = prevValue;
            args = this.prepareArgs(listener, args);
            return this.lcall(listener, args);
        }
        else if (returnType === ReturnType.UNTIL_TRUE && prevValue === true) {
            return true;
        }
        else if (returnType === ReturnType.UNTIL_FALSE && prevValue === false) {
            return false;
        }
        else if (returnType === ReturnType.FIRST_NON_EMPTY && prevValue !== null && prevValue !== undefined) {
            return prevValue;
        }
        return this.lcall(listener, args);
    }

    trigger(origArgs: any[], returnType: ReturnType | null = null, tags?: string[] | null): ReturnValue {

        if (this.queued) {
            this.queue.push([ origArgs, returnType ]);
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
            this.lastTrigger = origArgs.slice();
        }

        // in pipe mode if there is no listeners,
        // we just return piped value
        if (this.listeners.length === 0) {
            if (returnType === ReturnType.PIPE) {
                return origArgs[0];
            }
            else if (returnType === ReturnType.ALL || 
                    returnType === ReturnType.CONCAT || 
                    returnType === ReturnType.RAW) {
                return [];
            }
            else if (returnType === ReturnType.MERGE) {
                return {};
            }
            return;
        }

        const results: any[] = [],
            queue: Listener[] = this.listeners.slice(),
            isConsequent = returnType === ReturnType.PIPE ||
                            returnType === ReturnType.UNTIL_TRUE ||
                            returnType === ReturnType.UNTIL_FALSE ||
                            returnType === ReturnType.FIRST_NON_EMPTY;

        let args: any[],
            listener: Listener | undefined,
            listenerResult: any = null,
            hasPromises = false;

        while (listener = queue.shift()) {

            if (!listener) {
                continue;
            }

            args = this.prepareArgs(listener, origArgs);
            
            if (this.filter && this.filter.call(this.filterContext, args, listener) === false) {
                continue;
            }

            if (listener.filter && 
                listener.filter.call(this.getFilterContext(listener), args) === false) {
                continue;
            }

            if (tags && tags.length > 0 && 
                (!listener.tags || !tagsIntersect(tags, listener.tags))) {
                continue;
            }

            listener.count++;

            if (listener.start !== undefined && listener.count < listener.start) {
                continue;
            }

            if (isConsequent && results.length > 0) {
                let prev = results[ results.length - 1 ];
                if (hasPromises) {
                    if (!isPromise(prev)) {
                        prev = Promise.resolve(prev);
                    }
                    listenerResult = prev.then(
                        ((listener, args, returnType) => (value:any) => {
                            return this.lcallWPrev(listener, args, value, returnType);
                        })(listener, args, returnType)
                    );
                }
                else {
                    listenerResult = this.lcallWPrev(listener, args, prev, returnType);
                }
            }
            else {
                listenerResult = this.lcall(listener, args);
            }

            listener.called++;

            if (listener.called === listener.limit) {
                this.un(listener.fn, listener.context);
            }

            if (returnType === ReturnType.FIRST) {
                return listenerResult;
            }

            if (isConsequent) {
                switch (returnType) {
                    case ReturnType.UNTIL_TRUE: {
                        if (listenerResult === true) {
                            return true;
                        }
                        break;
                    }
                    case ReturnType.UNTIL_FALSE: {
                        if (listenerResult === false) {
                            return false;
                        }
                        break;
                    }
                    case ReturnType.FIRST_NON_EMPTY: {
                        if (!hasPromises && !isPromise(listenerResult) && 
                            listenerResult !== null && listenerResult !== undefined) {
                            return listenerResult;
                        }
                        break;
                    }
                }
            }

            if (!hasPromises && isPromise(listenerResult)) {
                hasPromises = true;
            }
    
            results.push(listenerResult);
        }


        switch (returnType) {
            case ReturnType.RAW: {
                return results;
            }
            case null: {
                if (hasPromises) {
                    return Promise.all(results).then(() => {});
                }
                return;
            }
            case ReturnType.ALL: {
                return hasPromises ? Promise.all(results) : results;
            }
            case ReturnType.CONCAT: {
                return hasPromises ? 
                    Promise.all(results).then(results => results.flat()) :
                    results.flat();
            }
            case ReturnType.MERGE: {
                return hasPromises ?
                    Promise.all(results).then(results => Object.assign.apply(null, [{}, ...results])) :
                    Object.assign.apply(null, [{}, ...results]);
            }
            case ReturnType.LAST: {
                return results.pop();
            }
            case ReturnType.UNTIL_TRUE: {
                return;
            }
            case ReturnType.UNTIL_FALSE: {
                return;
            }
            case ReturnType.FIRST_NON_EMPTY: {
                return Promise.all(results).then(results => results.find(r => r !== undefined && r !== null));
            }
            case ReturnType.PIPE: {
                return results[ results.length - 1 ];
            }
        }
    }

    resolve(origArgs: any[], returnType: ReturnType | null = null, tags?: string[] | null): Promise<any> {
        return Promise.resolve(this.trigger(origArgs, returnType, tags));
    }
}