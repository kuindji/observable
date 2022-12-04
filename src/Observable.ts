import Event from "./Event"
import type { EventOptions, ListenerOptions, Listener } from "./lib/types"

class Observable {

    events:{ [key: string]: Event } = {}


    /**
     * @method createEvent
     * @param {string} name {
     *      Event name
     *      @required
     * }
     * @param {object|string|bool} options {
     *  Options object or returnResult value. All options are optional.
     * 
     *  @type {string|bool} returnResult {
     *   false -- return first 'false' result and stop calling listeners after that<br>
     *   true -- return first 'true' result and stop calling listeners after that<br>
     *   "all" -- return all results as array<br>
     *   "concat" -- merge all results into one array (each result must be array)<br>
     *   "merge" -- merge all results into one object (each result much be object)<br>
     *   "pipe" -- pass return value of previous listener to the next listener.
     *             Only first trigger parameter is being replaced with return value,
     *             others stay as is.<br>
     *   "first" -- return result of the first handler (next listener will not be called)<br>
     *   "nonempty" -- return first nonempty result<br>
     *   "last" -- return result of the last handler (all listeners will be called)<br>
     *  }
     *  @type {bool} autoTrigger {
     *      once triggered, all future subscribers will be automatically called
     *      with last trigger params
     *      @code src-docs/examples/autoTrigger.js
     * }
     *  @type {function} triggerFilter {
     *      This function will be called each time event is triggered. 
     *      Return false to skip listener.
     *       @code src-docs/examples/triggerFilter.js
     *       @param {object} listener This object contains all information about the listener, including
     *           all data you provided in options while subscribing to the event.
     *       @param {[]} arguments
     *       @return {bool}
     *  }
     *  @type {object} filterContext triggerFilter's context
     *  @type {bool} expectPromises {   
     *      Expect listeners to return Promises. If <code>returnResult</code> is set,
     *      promises will be treated as return values unless <code>resolvePromises</code>
     *      is set.
     *  }
     *  @type {bool} resolvePromises {
     *      In pair with <code>expectPromises</code> and <code>returnResult</code>
     *      this option makes trigger function wait for promises to resolve.
     *      All or just one depends on returnResult mode. "pipe" mode 
     *      makes promises resolve consequentially passing resolved value
     *      to the next promise.
     *  }
     * }
     * @returns {Event}
     */
     createEvent(name: string, options: EventOptions|string|boolean = {}) {
        name = name.toLowerCase();
        if (!this.events[name]) {
            this.events[name] = new Event(name, options);
        }
        return this.events[name];
    }


    /**
    * @method
    * @access public
    * @param {string} name Event name
    * @return {Event|undefined}
    */
    getEvent(name: string):Event|undefined {
        name = name.toLowerCase();
        return this.events[name];
    }

    /**
    * @method
    * @access public
    * @param {string} name Event name
    * @return {boolean}
    */
    hasEvent(name: string):boolean {
        return !!this.events[name];
    }

    /**
    * Subscribe to an event or register collector function.
    * @method
    * @access public
    * @param {string} name {
    *       Event name. Use '*' to subscribe to all events.
    *       @required
    * }
    * @param {function} fn {
    *       Callback function
    *       @required
    * }
    * @param {object} options {
    *       You can pass any key-value pairs in this object. All of them will be passed 
    *       to triggerFilter (if you're using one).
    *       @type {bool} first {
    *           True to prepend to the list of handlers
    *           @default false
    *       }
    *       @type {number} limit {
    *           Call handler this number of times; 0 for unlimited
    *           @default 0
    *       }
    *       @type {number} start {
    *           Start calling handler after this number of calls. Starts from 1
    *           @default 1
    *       }
    *       @type {array} append Append parameters
    *       @type {array} prepend Prepend parameters
    *       @type {array} replaceArgs Replace parameters
    *       @type {bool|int} async run event asynchronously. If event was
    *                      created with <code>expectPromises: true</code>, 
    *                      this option is ignored.
    * }
    */
    on(name:string, fn:Function, options:ListenerOptions = {}) {
        name = name.toLowerCase();
        if (!this.events[name]) {
            this.events[name] = new Event(name);
        }
        return this.events[name].on(fn, options);
    }

    /**
    * @method
    * @access public
    */
    once(name:string, fn:Function, options:ListenerOptions = {}) {
        options.limit = 1;
        return this.on(name, fn, options);
    }

    /**
     * Subscribe to an event and return a promise that will be resolved
     * with event payload
     * @param {string} name Event name
     * @return {Promise}
     */
    promise(name:string):Promise<any> {
        return new Promise((resolve) => {
            this.once(name, resolve, { limit: 1 });
        });
    }

    /**
    * Unsubscribe from an event
    * @method
    * @access public
    * @param {string} name Event name
    * @param {function|number} fn Event handler
    * @param {object} context If you called on() with context you must 
    *                         call un() with the same context
    */
    un(name:string, fn:Function|number, context?:any):void {
        name = name.toLowerCase();
        if (!this.events[name]) {
            return;
        }
        this.events[name].un(fn, context);
    }


    /**
     * Relay all events of <code>eventSource</code> through this observable.
     * @method
     * @access public
     * @param {object} eventSource
     * @param {string} eventName
     * @param {string} triggerName
     * @param {string} triggerNamePfx prefix all relayed event names
     */
    relayEvent(eventSource:Observable, eventName:string, 
                triggerName:string|null = null, triggerNamePfx:string|null = null) {
        eventSource.on(eventName, this.trigger, {
            context: this,
            prepend: eventName === "*" ? 
                        null: 
                        // use provided new event name or original name
                        [triggerName || eventName],
            replace: eventName === "*" && triggerNamePfx ? 
                            function(args:any[]) {
                                args[0] = triggerNamePfx + args[0]
                                return args;
                            } : 
                            null
        });
    }

    /**
     * Stop relaying events of eventSource
     * @method
     * @access public
     * @param {object} eventSource
     * @param {string} eventName
     */
    unrelayEvent(eventSource: Observable, eventName: string) {
        eventSource.un(eventName, this.trigger, this);
    }

    /**
    * Trigger an event -- call all listeners. Also triggers '*' event.
    * @method
    * @access public
    * @param {string} name Event name { @required }
    * @param {*} ... As many other params as needed
    * @return mixed
    */
    trigger(name:string, ...args:any[]):any {

        let e:Event;
        let res:any;

        name = name.toLowerCase();

        if (this.events[name]) {
            e = this.events[name];
            res = e.trigger.apply(e, args);
        }

        // trigger * event with current event name
        // as first argument
        if (e = this.events["*"]) {
            e.trigger.apply(e, [ name, ...args ]);
        }

        return res;
    }

    /**
    * Suspend an event. Suspended event will not call any listeners on trigger().
    * @method
    * @access public
    * @param {string} name Event name
    */
    suspendEvent(name:string):void {
        name = name.toLowerCase();
        if (!this.events[name]) {
            return;
        }
        this.events[name].suspend();
    }


    /**
    * @method
    * @access public
    */
    suspendAllEvents():void {
        Object.keys(this.events).forEach((key:string) => this.events[key].suspend());
    }

    /**
    * Resume suspended event.
    * @method
    * @access public
    * @param {string} name Event name
    */
    resumeEvent(name:string):void {
        name = name.toLowerCase();
        if (!this.events[name]) {
            return;
        }
        this.events[name].resume();
    }

    /**
    * @method
    * @access public
    */
    resumeAllEvents():void {
        Object.keys(this.events).forEach((key:string) => this.events[key].resume());
    }

    /**
     * @method
     * @access public
     */
    hasListener(name?:string, fn:Function|number|null = null, context:any = null):boolean {

        if (name) {
            return this.getEvent(name)?.hasListener(fn, context) || false;
        }
        else {
            for (name in this.events) {
                if (this.events[name].hasListener()) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * @method
     * @access public
     * @param {string} name 
     */
    removeAllListeners(name:string):void {
        this.getEvent(name)?.removeAllListeners();
    }

    /**
     * @method
     * @access public
     * @param {string} name Event name
     */
    destroyEvent(name:string):void {
        const events  = this.events;
        if (events[name]) {
            events[name].removeAllListeners();
            delete events[name];
        }
    }
}

export default Observable