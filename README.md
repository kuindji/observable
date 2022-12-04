# Observable
A javascript event system implementing multiple patterns: observable, collector and pipe.

Observable:
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.on("event", (x, y, z) => console.log(x, y, z));
o.trigger("event", 1, 2, 3); // prints 1, 2, 3
```

Collector:
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.createEvent("collectStuff", "all");
o.on("collectStuff", () => 1);
o.on("collectStuff", () => 2);
const results = o.trigger("collectStuff"); // [1, 2]
```

Pipe:
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.createEvent("some-job", "pipe");
o.on("some-job", (value) => value + value);
o.on("some-job", (value) => value * value);

const result = o.trigger("some-job", 1); // 4
```

Autotrigger:
```javascript
const o = new Observable;
o.createEvent("auto", { autoTrigger: true });
// trigger first
o.trigger("auto", 1, 2);
// subscribe later
o.on("auto", (a, b) => console.log(a, b)); // immediately logs 1, 2
```

Promise:
```javascript
const o = new Observable;
o.promise("event").then(payload => console.log(payload));
o.trigger("event", { data: "hello world" });
```


Relay:
```javascript
const o1 = new Observable;
const o2 = new Observable;

o2.relayEvent(o1, "some-event");
o2.on("some-event", () => console.log("OK!"));
o1.trigger("some-event"); // OK!

o2.relayEvent(o1, "another-event", "local-name");
o2.on("local-name", () => console.log("OK!"));
o1.trigger("another-event"); // OK!
```

Filter:
```javascript 
const o = new Observable;
o.createEvent("filtered", {
    triggerFilter: (l, args) => {
        if (l.userData?.always) {
            return true;
        }
        if (l.userData?.param === args[0]) {
            return true;
        }
        return false;
    }
});

o.on("filtered", () => console.log("always"), {
    userData: { always: true }
});

o.on("filtered", () => console.log("param"), {
    userData: { param: 1 }
});

o.trigger("filtered", 2); // "always"
o.trigger("filtered", 1); // "always", "param"
```

Any event:
```javascript
const o = new Observable;
o.on("*", (eventName, x, y) => console.log(eventName, x, y));
o.trigger("event1", 1, 2); // prints event1 1 2
o.trigger("event2", 3, 4); // prints event2 3 4
```


API:
```javascript
/*
 * Create event
 * Events don't have to be "created" in order to be triggered.
 * Use this api to specify event's behaviour. 
 */
o.createEvent(
    /* required */ "eventName", 
    /* optional */ {

        /*  null -- default; do not return results
        *   false -- return first 'false' result and stop calling listeners after that
        *   true -- return first 'true' result and stop calling listeners after that
        *   "all" -- return all results as array
        *   "concat" -- merge all results into one array (each result must be array)
        *   "merge" -- merge all results into one object (each result much be object)
        *   "pipe" -- pass return value of previous listener to the next listener.
        *             Only first trigger parameter is being replaced with return value,
        *             others stay as is.
        *   "first" -- return result of the first handler (next listener will not be called)
        *   "nonempty" -- return first nonempty result
        *   "last" -- return result of the last handler (all listeners will be called)
        */
        "returnResult": string | boolean | null,

        /*
         * once triggered, all future subscribers will be automatically called
         * with last trigger params
         */
        "autoTrigger": boolean,

        /*
         * This function will be called each time event is triggered. 
         * Return false to skip listener.
         */
        "triggerFilter": function(listener, args) {},

        /*
         * "this" context to call triggerFilter in
         */
        "filterContext": any,

        /*
         * Expect listeners to return Promises. If returnResult is set,
         * promises will be treated as return values unless resolvePromises
         * is set.
         */
        "expectPromises": boolean,

        /*
         * In pair with expectPromises and returnResult
         * this option makes trigger function wait for promises to resolve.
         * All or just one depends on returnResult mode. "pipe" mode 
         * makes promises resolve consequentially passing resolved value
         * to the next promise.
         */
        "resolvePromises" boolean
    }
);

/*
 * If second parameter is not an object it resolves into { returnResult: <value> }
 */
o.createEvent("eventName", "all");

// Subscribe to event
// Returns listener id which can be used in un()
o.on(
    /* There is a special event name "*" 
     * Listeners of this event will be triggered on any event
     * as receive event name as the first argument
     */
    /* required */ "eventName",
    /* required */ () => {},
    /* optional */ {
        // "this" object to call listener with
        "context": null,

        // prepend to the list of listeners
        "first": false,

        // limit the number triggers for this listener (0 - no limit)
        "limit": 0,

        // start triggering listener after given number of triggers
        "start": 0,

        // append these arguments when calling the listener
        "append": array | (args, userData) => [],

        // prepend these arguments when calling the listener
        "prepend": array | (args, userData) => [],

        // replace with these arguments when calling the listener
        "replace": array | (args, userData) => [],

        // Run event asynchronously. 
        // If event was created with expectPromises: true this option is ignored
        // number = number of milliseconds
        // true = 1ms
        "async" boolean | number
    }
);

// Same as on() but it will automatically set options.limit to 1.
o.once(
    /* required */ "eventName",
    /* required */ () => {},
    /* optional */ {}
);

// Trigger an event
o.trigger(
    /* required */ "eventName",
    /* optional */ ...args
);

// Subscribe to an event and get a promise that will be resolved with event payload 
o.promise("eventName");

// Unsubscribe from event
o.un(
    /* required */ "eventName",
    /* required */ () => {} | number,
    /* optional */ context
);

// Relay another observable's event
o.relayEvent(
    /* required */ anotherObservable, 
    /* required */ "eventName" | "*",

    // when relaying all events ("*"),
    // use "triggerName" to replace original event names with this single one
    // or "triggerPrefix" to add this prefix to original event name
    /* optional */ "triggerName" | null,
    /* optional */ "triggerPrefix" | null
);

// Stop relaying events
o.unrelayEvent(
    /* required */ anotherObservable, 
    /* required */ "eventName" | "*"
);

o.suspendEvent("eventName");
o.suspendAllEvents();
o.resumeEvent("eventName");
o.resumeAllEvents();

// Check if already subscribed
o.hasListener(
    /* optional */ "eventName",
    /* optional */ function | number,
    /* optional */ context
);

// Remove all listeners from event
o.removeAllListeners("eventName");
// Remove all event listeners and reset options
o.destroyEvent("eventName");
```