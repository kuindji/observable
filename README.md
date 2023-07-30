# Observable
A javascript event bus implementing multiple patterns: observable, collector and pipe.

#### v2 is incomptable with v1, it is a complete rewrite.

### Observable:
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.on("event", (x, y, z) => console.log([x, y, z]));
o.trigger("event", 1, 2, 3); // [1, 2, 3]
// other methods:
o.untilTrue("event")
o.untilFalse("event")
```

### Collector:
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.on("collectStuff", () => 1);
o.on("collectStuff", () => 2);
const results = o.all("collectStuff"); // [1, 2]
```
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.on("collectStuff", () => Promise.resolve(1));
o.on("collectStuff", () => Promise.resolve(2));
o.on("collectStuff", () => 3);
const results = await o.resolveAll("collectStuff"); // [1, 2, 3]
```
Other collector methods:
```javascript
o.first("event")
o.last("event")
o.firstNonEmpty("event")
o.concat("event")
o.merge("event")
o.raw("event")
```

### Pipe:
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.on("some-job", (value) => value + value);
o.on("some-job", (value) => value * value);
const result = o.pipe("some-job", 1); // 4
```
```javascript
const Observable = require("@kuindji/observable");
const o = new Observable;
o.on("some-job", (value) => Promise.resolve(value + value));
o.on("some-job", (value) => Promise.resolve(value * value));
const result = await o.resolvePipe("some-job", 1); // 4
```

### Autotrigger:
```javascript
const o = new Observable;
o.createEvent("auto", { autoTrigger: true });
// trigger first
o.trigger("auto", 1, 2);
// subscribe later
o.on("auto", (a, b) => console.log(a, b)); // immediately logs 1, 2
```

### Promise:
```javascript
const o = new Observable;
o.promise("event").then(payload => console.log(payload));
o.trigger("event", { data: "hello world" });
```


### Relay:
```javascript
const o1 = new Observable;
const o2 = new Observable;

o2.relay(o1, "some-event");
o2.on("some-event", () => console.log("OK!"));
o1.trigger("some-event"); // OK!

o2.relay(o1, "another-event", "local-name");
o2.on("local-name", () => console.log("OK!"));
o1.trigger("another-event"); // OK!

o2.unrelay(o1, "some-event");
```

### Filter:
```javascript 
const o = new Observable;
o.createEvent("filtered", {
    filter: (args, l) => {
        if (l.extraData?.always) {
            return true;
        }
        if (l.extraData?.param === args[0]) {
            return true;
        }
        return false;
    }
});

o.on("filtered", () => console.log("always"), {
    extraData: { always: true }
});

o.on("filtered", () => console.log("param"), {
    extraData: { param: 1 }
});

o.trigger("filtered", 2); // "always"
o.trigger("filtered", 1); // "always", "param"
```

### Any event:
```javascript
const o = new Observable;
o.on("*", (eventName, x, y) => console.log(eventName, x, y));
o.trigger("event1", 1, 2); // prints event1 1 2
o.trigger("event2", 3, 4); // prints event2 3 4
```


### API:
```javascript
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

        /*
         * This function will be called each time event is triggered. 
         * Return false to skip listener.
         */
        "filter": function(args, listener?) {},

        /*
         * "this" context to call triggerFilter in
         */
        "filterContext": any,

        // prepend to the list of listeners
        "first": false,

        // always call this listener before others
        "alwaysFirst": false,

        // always call this listener after others
        "alwaysLast": false,

        // limit the number of triggers for this listener (0 - no limit)
        "limit": 0,

        // start triggering listener after given number of triggers
        "start": 0,

        // append these arguments when calling the listener
        "append": array | (listener, args) => [],

        // prepend these arguments when calling the listener
        "prepend": array | (listener, args) => [],

        // replace with these arguments when calling the listener
        "replaceArgs": array | (listener, args) => [],

        // Run event asynchronously. 
        // number = number of milliseconds
        // true = 0ms
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
o.trigger(/* required */ "eventName", /* optional */ ...args);
o.untilTrue(/* required */ "eventName", /* optional */ ...args);
o.untilFalse(/* required */ "eventName", /* optional */ ...args);

// Collect data (these may return promise or value depending on what listener returns)
const arr = o.raw(/* required */ "eventName", /* optional */ ...args);
const arr = o.all(/* required */ "eventName", /* optional */ ...args);
const obj = o.merge(/* required */ "eventName", /* optional */ ...args);
const arr = o.concat(/* required */ "eventName", /* optional */ ...args);
const value = o.firstNonEmpty(/* required */ "eventName", /* optional */ ...args);
const value = o.first(/* required */ "eventName", /* optional */ ...args);
const value = o.last(/* required */ "eventName", /* optional */ ...args);

// Collect async data (these will always return Promise)
const all = await o.resolveAll(/* required */ "eventName", /* optional */ ...args);
const obj = await o.resolveMerge(/* required */ "eventName", /* optional */ ...args);
const arr = await o.resolveConcat(/* required */ "eventName", /* optional */ ...args);
const value = await o.resolveFirstNonEmpty(/* required */ "eventName", /* optional */ ...args);
const value = await o.resolveFirst(/* required */ "eventName", /* optional */ ...args);

// Collect pipe data (may return promise or value depending on what listener returns)
const value = o.pipe(/* required */ "eventName", /* optional */ arg);
// Collect async pipe data (will always return Promise)
const value = await o.resolvePipe(/* required */ "eventName", /* optional */ arg);

// Subscribe to an event and get a promise that will be resolved with event payload 
await o.promise("eventName");

// Unsubscribe from event
o.un(
    /* required */ "eventName",
    /* required */ () => {},
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


/*
 * Listener context 
 */
class A = {
    handler() {}
}
const a = new A;
const b = new A;
// you can do this instead of a.handler.bind(a)
o.on("event", a.handler, { context: a });
o.on("event", b.handler, { context: b });


/*
 * Create event
 * Events don't have to be "created" in order to be triggered.
 * Use this api to specify event's behaviour. 
 */
o.createEvent(
    /* required */ "eventName", 
    /* optional */ {
        /*
         * once triggered, all future subscribers will be automatically called
         * with last trigger params
         */
        "autoTrigger": boolean,

        /*
         * This function will be called each time event is triggered. 
         * Return false to skip listener.
         */
        "filter": function(args, listener?) {},

        /*
         * "this" context to call triggerFilter in
         */
        "filterContext": any,
        /**
         * Append parameters
         */
        "append": array | (listener, args) => [],
        /**
         * Prepend parameters
         */
        "prepend": array | (listener, args) => [],
        /**
         * Replace parameters
         */
        "replaceArgs": array | (listener, args) => [],
        /**
         * Call this listener asynchronously. Milliseconds or true|false
         */
        "async": boolean | number,
    }
);

// Remove all event listeners and reset options
o.destroyEvent("eventName");
```