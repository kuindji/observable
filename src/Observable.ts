import ObservableEvent from "./ObservableEvent"
import { ObservablePubliApi, 
            ReturnType, 
            EventOptions, 
            ListenerOptions, 
            ListenerFunction, 
            ReturnValue,
            EventSource,
            ProxyType,
            ProxyListener } from "./types"

type EventsMap = {
    [key: string]: ObservableEvent
}

type ProxyListenerMap = {
    [key: string]: ProxyListener
}

/**
 * A javascript event bus implementing multiple patterns: 
 * observable, collector and pipe.
 * @author Ivan Kuindzhi
 */
export default class Observable {

    events: EventsMap = {}
    external: ProxyListenerMap = {}
    eventSources: EventSource[] = []
    publicApi: ObservablePubliApi | null = null;

    /**
     * Use this method only if you need to provide event-level options
     * @param name Event name
     * @param options Event options
     */
    createEvent(name: string, options?: EventOptions): void {
        const events  = this.events;
        if (!events[name]) {
            events[name] = new ObservableEvent(options);
        }
    }

    /**
    * Subscribe to an event or register collector function.
    * @param name Event name. Use '*' to subscribe to all events.
    * @param fn Callback function
    * @param options You can pass any key-value pairs in this object. All of them will be passed 
    *       to triggerFilter (if you're using one).
    */
    on(name: string, fn: ListenerFunction, options?: ListenerOptions): void {

        if (this.eventSources.length > 0) {
            this.eventSources.forEach((evs: EventSource) => {
                if (evs.accepts === false || (typeof evs.accepts === "function" && !evs.accepts(name))) {
                    return;
                }
                if (evs.subscribed.indexOf(name) === -1) {
                    evs.on(name, this.proxy(name, evs.proxyType), evs, options);
                    evs.subscribed.push(name);
                }
            });
        }
        
        const events  = this.events;
        if (!events[name]) {
            events[name] = new ObservableEvent();
        }
        events[name].on(fn, options);
    }

    /**
    * Same as <code>on()</code>, but options.limit is forcefully set to 1.
    * @param name Event name
    * @param fn Listener
    * @param options? listener options
    */
    once(name: string, fn: ListenerFunction, options?: ListenerOptions): void {
        options = options || {};
        options.limit = 1;
        this.on(name, fn, options);
    }

    /**
     * Same as <code>once()</code> but as Promise with event payload as resolved value
     * @param name Event name
     * @param options?
     */
    promise(name: string, options?: ListenerOptions): Promise<any> {
        return new Promise((resolve) => {
            this.once(name, resolve, options);
        });
    }

    /**
    * Unsubscribe from an event
    * @param name Event name
    * @param fn Event handler
    * @param context If you called on() with context you must 
    *                         call un() with the same context
    */
    un(name: string, fn: ListenerFunction, context?: object): void {
        const events  = this.events;
        if (!events[name]) {
            return;
        }
        events[name].un(fn, context);

        if (this.eventSources.length > 0) {
            const empty = !events[name].hasListener();
            this.eventSources.forEach((evs: EventSource) => {
                const inx = evs.subscribed.indexOf(name);
                const key = name + "-" + evs.proxyType;
                if (inx !== -1) {
                    evs.subscribed.splice(inx, 1);
                    if (empty) {
                        evs.un(name, this.external[key], evs);
                    }
                }
            });
        }
    }

    /**
     * Relay all events of <code>eventSource</code> through this observable.
     * @param eventSource
     * @param eventName
     * @param triggerName
     * @param triggerNamePfx prefix all relayed event names
     * @param proxyType
     */
    relay(eventSource: Observable, eventName: string, 
                triggerName?: string | null, triggerNamePfx?: string | null,
                proxyType: ProxyType = ProxyType.TRIGGER) {
        eventSource.on(eventName, this[proxyType], {
            context: this,
            prependArgs: eventName === "*" ? 
                        undefined: 
                        // use provided new event name or original name
                        [triggerName || eventName],
            replaceArgs: eventName === "*" && triggerNamePfx ? 
                            function(l, args) {
                                args[0] = triggerNamePfx + args[0]
                                return args;
                            } : 
                            undefined
        });
    }

    /**
     * Stop relaying events of <code>eventSource</code>
     * @param eventSource
     * @param eventName
     */
    unrelay(eventSource: Observable, eventName: string) {
        eventSource.un(eventName, this.trigger, this);
    }

    /**
     * @param eventSource 
     */
    addEventSource(eventSource: EventSource): void {
        if (!this.hasEventSource(eventSource.name)) {
            this.eventSources.push({ 
                proxyType: ProxyType.TRIGGER,
                ...eventSource, 
                subscribed: [] 
            });
        }
    }

    /**
     * @param name  eventSource name or eventSource
     */
    removeEventSource(name: string | EventSource) {
        const inx = this.eventSources.findIndex(
            evs => typeof name === "string" ? evs.name === name : evs.name === name.name
        );
        if (inx !== -1) {
            const evs = this.eventSources[inx];
            evs.subscribed.forEach((name: string) => {
                const key = name + "-" + evs.proxyType;
                evs.un(name, this.external[key], evs);
            })
            this.eventSources.splice(inx, 1);
        }
    }

    /**
     * Check if event source with given name was added
     * @param name 
     */
    hasEventSource(name: string | EventSource): boolean {
        const inx = this.eventSources.findIndex(
            evs => typeof name === "string" ? evs.name === name : evs.name === name.name
        );
        return inx !== -1;
    }

    /**
     * Create a listener function for external event bus that will relay events through
     * this observable
     * @param name Event name in this observable
     * @param proxyType 
     */
    proxy(name: string, proxyType: ProxyType = ProxyType.TRIGGER): ProxyListener {
        const key = name + "-" + proxyType;
        if (!this.external[key]) {
            this.external[key] = (...args) => {
                const res = this[proxyType].apply(this, [ name, ...args ]);
                if (proxyType !== "trigger") {
                    return res;
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
    has(name?: string, fn?: ListenerFunction, context?: object): boolean {
        const events = this.events;

        if (name) {
            if (!events[name]) {
                return false;
            }
            return events[name].hasListener(fn, context);
        }
        else {
            for (name in events) {
                if (events[name].hasListener()) {
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
    hasListener(name?: string, fn?: ListenerFunction, context?: object): boolean {
        return this.has(name, fn, context);
    }


    /**
    * Remove all listeners from specific event or from all events
    * @param name Event name
    */
    removeAllListeners(name: string) {
        const events  = this.events;
        if (name) {
            if (!events[name]) {
                return;
            }
            events[name].removeAllListeners();
        }
        else {
            for (name in events) {
                events[name].removeAllListeners();
            }
        }
    }

    /**
     * Trigger event and return all results from the listeners
     * @param name Event name
     * @param [...args]
     */
    all(name: string, ...args: any[]): any[] | Promise<any[]> {
        return this._trigger(name, args, ReturnType.ALL);
    }

    /**
     * Trigger event and return a promise with results from the listeners
     * @param name Event name
     * @param [...args]
     */
    resolveAll(name: string, ...args: any[]): Promise<any[]> {
        return this._trigger(name, args, ReturnType.ALL, true);
    }

    /**
     * Trigger first event's listener and return its result
     * @param name Event name
     * @param [...args]
     */
    first(name: string, ...args: any[]): any | Promise<any> {
        return this._trigger(name, args, ReturnType.FIRST);
    }

    /**
     * Trigger first event's listener and return its result as a promise
     * @param name Event name
     * @param [...args]
     */
    resolveFirst(name: string, ...args: any[]): Promise<any> {
        return this._trigger(name, args, ReturnType.FIRST, true);
    }

    /**
     * Trigger event and return last listener's result
     * @param name Event name
     * @param [...args]
     */
    last(name: string, ...args: any[]): any | Promise<any> {
        return this._trigger(name, args, ReturnType.LAST);
    }

    /**
     * Trigger event and return last listener's result as a promise
     * @param name Event name
     * @param [...args]
     */
    resolveLast(name: string, ...args: any[]): Promise<any> {
        return this._trigger(name, args, ReturnType.LAST, true);
    }

    /**
     * Trigger event and return all results from the listeners merged into one object
     * @param name Event name
     * @param [...args]
     */
    merge(name: string, ...args: any[]): object | Promise<object> {
        return this._trigger(name, args, ReturnType.MERGE);
    }

    /**
     * Trigger event and return as a promise all results from the listeners merged into one object
     * @param name Event name
     * @param [...args]
     */
    resolveMerge(name: string, ...args: any[]): Promise<object> {
        return this._trigger(name, args, ReturnType.MERGE, true);
    }


    /**
     * Trigger event and return all results from the listeners flattened into one array
     * @param name Event name
     * @param [...args]
     */
    concat(name: string, ...args: any[]): any[] | Promise<any[]> {
        return this._trigger(name, args, ReturnType.CONCAT);
    }

    /**
     * Trigger event and return as a promise all results from the listeners flattened into one array
     * @param name Event name
     * @param [...args]
     */
    resolveConcat(name: string, ...args: any[]): Promise<any[]> {
        return this._trigger(name, args, ReturnType.CONCAT, true);
    }

    /**
     * Trigger event and return first non-empty listener result and skip others
     * @param name Event name
     * @param [...args]
     */
    firstNonEmpty(name: string, ...args: any[]): any | Promise<any> {
        return this._trigger(name, args, ReturnType.FIRST_NON_EMPTY);
    }

    /**
     * Trigger event and return as a promise first non-empty listener result and skip others
     * @param name Event name
     * @param [...args]
     */
    resolveFirstNonEmpty(name: string, ...args: any[]): Promise<any> {
        return this._trigger(name, args, ReturnType.FIRST_NON_EMPTY, true);
    }

    /**
     * Trigger event and return first listener result that equals true and skip others
     * @param name Event name
     * @param [...args]
     */
    untilTrue(name: string, ...args: any[]): void | Promise<void> {
        return this._trigger(name, args, ReturnType.UNTIL_TRUE);
    }

    /**
     * Trigger event and return first listener result that equals false and skip others
     * @param name Event name
     * @param [...args]
     */
    untilFalse(name: string, ...args: any[]): void | Promise<void> {
        return this._trigger(name, args, ReturnType.UNTIL_FALSE);
    }

    /**
     * Trigger event and pass previous listener's return value into next listener and return last result
     * @param name Event name
     * @param [...args]
     */
    pipe(name: string, ...args: any[]): any | Promise<any> {
        return this._trigger(name, args, ReturnType.PIPE);
    }

    /**
     * Trigger event and pass previous listener's return value into next listener and return 
     * last result as promise
     * @param name Event name
     * @param [...args]
     */
    resolvePipe(name: string, ...args: any[]): Promise<any> {
        return this._trigger(name, args, ReturnType.PIPE, true);
    }

    /**
     * Trigger event and return all results as is
     * @param name Event name
     * @param [...args]
     */
    raw(name: string, ...args: any[]): any[] | Promise<any>[] {
        return this._trigger(name, args, ReturnType.RAW);
    }

    /**
     * Trigger all listeners of the event, do not return anything
     * @param name 
     * @param [...args]
     */
    trigger(name: string, ...args: any[]): void | Promise<void> {
        return this._trigger(name, args);
    }

    _trigger(name: string, args: any[], returnType: ReturnType | null = null, resolve: boolean = false): ReturnValue {

        const events = this.events;
        let e: ObservableEvent;

        if (e = events[name]) {
            return resolve ? e.resolve(args, returnType) : e.trigger(args, returnType);
        }

        // trigger * event with current event name
        // as first argument
        if (e = events["*"]) {
            return resolve ? 
                e.resolve([ name, ...args ], returnType) : 
                e.trigger([ name, ...args ], returnType);
        }
    }

    /**
    * Suspend an event. Suspended event will not call any listeners on trigger().
    * If withQueue=true, events will be triggered after resume()
    * @param name Event name
    * @param withQueue enable events queue
    */
    suspendEvent(name: string, withQueue: boolean = false) {
        const events  = this.events;
        if (!events[name]) {
            events[name] = new ObservableEvent();
        }
        events[name].suspend(withQueue);
    }

    /**
     * Check if event was suspended
     * @param name Event name
     */
    isSuspended(name: string): boolean {
        const events  = this.events;
        if (!events[name]) {
            return false;
        }
        return events[name].suspended;
    }

    /**
     * Check if event was suspended with queue
     * @param name Event name
     */
    isQueued(name: string): boolean {
        const events  = this.events;
        if (!events[name]) {
            return false;
        }
        return events[name].queued;
    }

    /**
    * Suspend all events. Suspended event will not call any listeners on trigger().
    * If withQueue=true, events will be triggered after resume()
    * @param withQueue enable events queue
    */
    suspendAllEvents(withQueue: boolean = false) {
        const events  = this.events;
        for (const name in events) {
            events[name].suspend(withQueue);
        }
    }

    /**
    * Resume suspended event.
    * @param name Event name
    */
    resumeEvent(name: string) {
        if (!this.events[name]) {
            return;
        }
        this.events[name].resume();
    }

    resumeAllEvents() {
        const events  = this.events;
        for (const name in events) {
            events[name].resume();
        }
    }

    /**
     * @param name Event name
     */
    destroyEvent(name: string) {
        const events  = this.events;
        if (events[name]) {
            events[name].removeAllListeners();
            events[name].$destroy();
            delete events[name];
        }
    }

    getPublicApi(): ObservablePubliApi {
        if (this.publicApi === null) {
            this.publicApi = {
                on: this.on.bind(this),
                un: this.un.bind(this),
                once: this.once.bind(this),
                has: this.has.bind(this)
            }
        }
        return this.publicApi;
    }

    /**
    * Destroy observable
    */
    $destroy() {
        const events = this.events;
        const eventSources = this.eventSources;

        eventSources.forEach(ev => this.removeEventSource(ev));

        for (const name in events) {
            this.destroyEvent(name);
        }

        this.events = {};
        this.external = {};
        this.eventSources = [];
        this.publicApi = null;
    }
};
