import type { EventOptions, ListenerOptions, Listener, 
                EventFilterCallback, ListenerPublicInfo } from "./lib/types"
import async from "./lib/async"


class Event {

    name:string
    listeners:Listener[] = []
    suspended:boolean = false
    lid:number = 0
    returnResult:string|boolean|null = null
    limit:number = 0
    triggered:number = 0
    autoTrigger:boolean|null = null
    lastTrigger:any[]|null = null
    triggerFilter:EventFilterCallback|null = null
    filterContext:any = null
    expectPromises:boolean = false
    keepPromiseOrder:boolean = false
    resolvePromises:boolean = false

    constructor(name: string, options?: EventOptions|string|boolean) {
        this.name   = name;

        if (options !== undefined) {
            if (typeof options === "string" || typeof options === "boolean" || options === null) {
                this.returnResult = options;
            }
            else {
                Object.assign(this, options);
            }
        }
    }

    /**
     * Get event name
     * @method
     * @returns {string}
     */
    getName():string {
        return this.name;
    }

    _findListener(fn:Function|number, context:any = null) {
        return this.listeners.findIndex(l => {
            if (l.context !== context) {
                return false;
            }
            if (typeof fn === "number" && l.id !== fn) {
                return false;
            }
            else if (typeof fn === "function" && l.fn !== fn) {
                return false;
            }
            return true;
        });
    }

    on(fn:Function, options:ListenerOptions = {}):number {

        const ex = this._findListener(fn, options.context);
        if (ex !== -1) {
            return this.listeners[ex].id;
        }

        const e:Listener = {
            id:         ++this.lid,
            fn:         fn,
            context:    null,
            async:      0,
            called:     0,          // how many times the function was triggered
            limit:      0,          // how many times the function is allowed to trigger
            start:      1,          // from which attempt it is allowed to trigger the function
            count:      0,          // how many attempts to trigger the function was made
            append:     null,       // append parameters
            prepend:    null,       // prepend parameters
            replace:    null,       // replace parameters
            filter:     null,
            filterContext: null,
            userData:   null
        };

        options.context !== undefined && (e.context = options.context);
        options.limit !== undefined && (e.limit = options.limit);
        options.start !== undefined && (e.start = options.start);
        options.append !== undefined && (e.append = options.append);
        options.prepend !== undefined && (e.prepend = options.prepend);
        options.replace !== undefined && (e.replace = options.replace);
        options.filter !== undefined && (e.filter = options.filter);
        options.filterContext !== undefined && (e.filterContext = options.filterContext);
        options.userData !== undefined && (e.userData = options.userData);

        if (options.async === true) {
            e.async = 1;
        }
        else if (options.async) {
            e.async = options.async;
        }

        if (options.once) {
            e.limit = 1;
        }

        if (options.first) {
            this.listeners.unshift(e);
        }
        else {
            this.listeners.push(e);
        }

        if (this.autoTrigger && this.lastTrigger && !this.suspended) {
            const prevFilter = this.triggerFilter;
            this.triggerFilter = function(l:ListenerPublicInfo){
                if (l.id === e.id) {
                    return prevFilter ? prevFilter(l) !== false : true;
                }
                return false;
            };
            this.trigger.apply(this, this.lastTrigger);
            this.triggerFilter = prevFilter;
        }

        return e.id;
    }

    /**
     * @method
     * @param {function} fn Callback function { @required }
     * @param {object} options See {@link class:Observable.on}
     */
    once(fn:Function, options:ListenerOptions = {}):number {
        options.limit = 1;
        return this.on(fn, options);
    }

    /**
     * @method
     * @param {function} fn Callback function { @required }
     * @param {object} context Callback context
     */
    un(fn:Function|number, context:any = null):boolean {
        
        const inx = this._findListener(fn, context);

        if (inx === -1) {
            return false;
        }

        this.listeners.splice(inx, 1);
        return true;
    }


    /**
     * @method hasListener
     * @return bool
     */

    /**
     * @method
     * @param {function} fn Callback function
     * @param {object} context Callback context
     * @return boolean
     */
     hasListener(fn:Function|number|null = null, context:any = null) {

        if (fn) {
            return this._findListener(fn, context) !== -1;
        }
        else {
            return this.listeners.length > 0;
        }
    }


    /**
     * @method
     * @return {*}
     */
    trigger(...args:any[]):any {

        const   filter          = this.triggerFilter,
                filterContext   = this.filterContext,
                expectPromises  = this.expectPromises,
                origArgs        = Array.from(args),
                returnMode      = this.returnResult;
        
        let keepPromiseOrder = this.keepPromiseOrder;
        let prevPromise, resPromise, listenerArgs = [], resolver, results = [];
        let returnValue:any = returnMode === "all" || returnMode === "concat" ?
                            [] : 
                            (returnMode === "merge" ? {} : null),
            queue, listener,
            res:any|null;

        if (this.suspended) {
            return null;
        }
        if (this.limit > 0 && this.triggered >= this.limit) {
            return null;
        }
        this.triggered++;

        if (this.autoTrigger) {
            this.lastTrigger = origArgs.slice();
        }

        // in pipe mode if there is no listeners,
        // we just return piped value
        if (this.listeners.length === 0) {
            if (returnMode === "pipe") {
                return origArgs[0];
            }
            return null;
        }

        

        if (returnMode === "first") {
            queue = [this.listeners[0]];
        }
        else {
            // create a snapshot of listeners list
            queue = this.listeners.slice();
        }

        if (expectPromises && returnMode === "last") {
            keepPromiseOrder = true;
        }

        // now if during triggering someone unsubscribes
        // we won't skip any listener due to shifted
        // index
        while (listener = queue.shift()) {

            // listener may already have unsubscribed
            if (!listener) {
                continue;
            }

            listenerArgs = this._prepareArgs(listener, origArgs);

            if (filter && filter.call(
                filterContext, 
                { id: listener.id, userData: listener.userData },
                listenerArgs) === false) {
                continue;
            }

            if (listener.filter && listener.filter.apply(
                listener.filterContext || listener.context, listenerArgs) === false) {
                continue;
            }

            listener.count++;

            if (listener.count < listener.start) {
                continue;
            }

            if (listener.async && !expectPromises) {
                res = null;
                async(listener.fn, listener.context, listenerArgs, listener.async);
            }
            else {
                if (expectPromises) {
                    resolver = this._createResolver(listener, returnMode, origArgs.slice());

                    if (prevPromise) {
                        res = prevPromise.then(resolver);
                    }
                    else {
                        res = listener.fn.apply(listener.context, listenerArgs);
                    }
                }
                else {
                    res = listener.fn.apply(listener.context, listenerArgs);
                }
            }

            listener.called++;

            if (listener.called === listener.limit) {
                this.un(listener.id);
            }

            // This rule is valid in all cases sync and async.
            // It either returns first value or first promise.
            if (returnMode === "first") {
                return res;
            }
        
            // Promise branch
            if (expectPromises) {
            
                // we collect all results for further processing/resolving
                results.push(res);

                if ((returnMode === "pipe" || keepPromiseOrder) && res) {
                    prevPromise = res;
                }
            }
            else {
                if (returnMode !== null) {
                    if (returnMode === "all") {
                        returnValue.push(res);
                    }
                    else if (returnMode === "concat" && res) {
                        returnValue = returnValue.concat(res);
                    }
                    else if (returnMode === "merge") {
                        Object.assign(returnValue, res);
                    }
                    else if (returnMode === "nonempty" && res) {
                        return res;
                    }
                    else if (returnMode === "pipe") {
                        returnValue = res;
                        origArgs[0] = res;
                    }
                    else if (returnMode === "last") {
                        returnValue = res;
                    }
                    else if (returnMode === false && res === false) {
                        return false;
                    }
                    else if (returnMode === true && res === true) {
                        return true;
                    }
                }
            }
        }

        if (expectPromises) {
            if (returnMode === "pipe") {
                return prevPromise;
            }

            resPromise = Promise.all(results);

            if (this.resolvePromises && returnMode !== null && returnMode !== "all") {
                resPromise = resPromise.then(function(values){
                    var i, l = values.length, res;
                    for(i = 0; i < l; i++) {
                        res = values[i];
                        if (returnMode === "concat" && res) {
                            returnValue = returnValue.concat(res);
                        }
                        else if (returnMode === "merge") {
                            Object.assign(returnValue, res);
                        }
                        else if (returnMode === "nonempty" && res) {
                            return res;
                        }
                        else if (returnMode === "last") {
                            returnValue = res;
                        }
                        else if (returnMode === false && res === false) {
                            return false;
                        }
                        else if (returnMode === true && res === true) {
                            return true;
                        }
                    }
                    return returnValue;
                });
            }
            return resPromise;
        }
        else return returnValue;
    }

    /**
     * @method
     */
    suspend():void {
        this.suspended = true;
    }

    /**
     * @method
     */
    resume():void {
        this.suspended = false;
    }

    /**
     * @method
     */
    removeAllListeners():void {
        this.listeners = [];
    }

    _createResolver(listener:Listener, returnMode:string|boolean|null, args:any[]):Function {
        return (value:any) => {

            if (returnMode === "pipe") {
                args[0] = value;
                args = this._prepareArgs(listener, args);
            }
            
            return listener.fn.apply(listener.context, args);
        }
    }

    _prepareArgs(l:Listener, triggerArgs:any[]) {
        let args, prepend, append, repl;

        if (l.append || l.prepend) {
            prepend = l.prepend;
            append  = l.append;
            args    = triggerArgs.slice();

            if (prepend) {
                if (typeof prepend === "function") {
                    prepend = prepend(triggerArgs, l.userData);
                }
                args    = prepend.concat(args);
            }
            if (append) {
                if (typeof append === "function") {
                    append = append(triggerArgs, l.userData);
                }
                args    = args.concat(append);
            }
        }
        else if (l.replace) {
            repl = l.replace;
            if (typeof repl === "function") {
                repl = repl(triggerArgs, l.userData);
            }
            args = repl.slice();
        }
        else {
            args = triggerArgs;
        }

        return args;
    }

}

export default Event