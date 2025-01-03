# Observable

A javascript event bus implementing multiple patterns: observable, collector and pipe.

#### v2 is incomptable with v1, it is a complete rewrite.

### Observable:

```javascript
const Observable = require('@kuindji/observable');
const o = new Observable();
o.on('event', (x, y, z) => console.log([x, y, z]));
o.trigger('event', 1, 2, 3); // [1, 2, 3]
// other methods:
o.untilTrue('event');
o.untilFalse('event');
```

### Collector:

```javascript
const Observable = require('@kuindji/observable');
const o = new Observable();
o.on('collectStuff', () => 1);
o.on('collectStuff', () => 2);
const results = o.all('collectStuff'); // [1, 2]
```

```javascript
const Observable = require('@kuindji/observable');
const o = new Observable();
o.on('collectStuff', () => Promise.resolve(1));
o.on('collectStuff', () => Promise.resolve(2));
o.on('collectStuff', () => 3);
const results = await o.resolveAll('collectStuff'); // [1, 2, 3]
```

Other collector methods:

```javascript
o.first('event');
o.last('event');
o.firstNonEmpty('event');
o.concat('event');
o.merge('event');
o.raw('event');
```

### Pipe:

```javascript
const Observable = require('@kuindji/observable');
const o = new Observable();
o.on('some-job', (value) => value + value);
o.on('some-job', (value) => value * value);
const result = o.pipe('some-job', 1); // 4
```

```javascript
const Observable = require('@kuindji/observable');
const o = new Observable();
o.on('some-job', (value) => Promise.resolve(value + value));
o.on('some-job', (value) => Promise.resolve(value * value));
const result = await o.resolvePipe('some-job', 1); // 4
```

### Autotrigger:

```javascript
const o = new Observable();
o.setEventOptions('auto', { autoTrigger: true });
// trigger first
o.trigger('auto', 1, 2);
// subscribe later
o.on('auto', (a, b) => console.log(a, b)); // immediately logs 1, 2
```

### Promise:

```javascript
const o = new Observable();
o.promise('event').then((payload) => console.log(payload));
o.trigger('event', { data: 'hello world' });
```

### Relay:

```javascript
const o1 = new Observable();
const o2 = new Observable();

o2.relay(o1, 'some-event');
o2.on('some-event', () => console.log('OK!'));
o1.trigger('some-event'); // OK!

o2.relay(o1, 'another-event', 'local-name');
o2.on('local-name', () => console.log('OK!'));
o1.trigger('another-event'); // OK!

o2.unrelay(o1, 'some-event');

const o = new Observable();
const eventEmitter = new EventEmitter();
// simple proxy for one specific event
eventEmitter.on('source-event', o.proxy('target-event'));
o.on('target-event', () => console.log('ok'));
eventEmitter.emit('source-event'); // ok

// full proxy to another event bus
o.addEventSource({
    name: 'EventEmitter',
    on: (eventName, listener) =>
        eventEmitter.on(eventName.replace('emitter-', ''), listener),
    un: (eventName, listener) =>
        eventEmitter.off(eventName.replace('emitter-', ''), listener),
    accepts: (eventName) => eventName.indexOf('emitter-') === 0,
});
o.on('emitter-event', () => console.log('triggered from EventEmitter'));
eventEmitter.emit('event'); // triggered from EventEmitter
```

### Filter:

```javascript
const o = new Observable();
o.setEventOptions('filtered', {
    filter: (args, l) => {
        if (l.extraData?.always) {
            return true;
        }
        if (l.extraData?.param === args[0]) {
            return true;
        }
        return false;
    },
});

o.on('filtered', () => console.log('always'), {
    extraData: { always: true },
});

o.on('filtered', () => console.log('param'), {
    extraData: { param: 1 },
});

o.trigger('filtered', 2); // "always"
o.trigger('filtered', 1); // "always", "param"
```

### Any event:

```javascript
const o = new Observable();
o.on('*', (eventName, x, y) => console.log(eventName, x, y));
o.trigger('event1', 1, 2); // prints event1 1 2
o.trigger('event2', 3, 4); // prints event2 3 4
```

### Typed events:

```javascript
// You can define event handler signatures
// by extending the module or providing event map directly:
import Observable, { EventMap, EventMapDefinition } from "@kuindji/observable";

const observableId = Symbol();

declare module "@kuindji/observable" {
    interface EventMap {
        "text-id": EventMapDefinition<{
            "event": EventDefinition<
                // trigger arguments signature
                [{ username: string; password: string }],
                // handler return type
                boolean,
                // optional handler signature
                // in case arguments are being transformed
                [type, type]
            >;
        }>;
        [observableId]: EventMapDefinition<{
            "event": EventDefinition<
                [string, boolean],
                number
            >;
        }>;
    }
}

type AnotherEventMap = {
    "my-event": EventDefinition<
        [string, boolean],
        number
    >
}

// passing event map ids
const o1 = new Observable<"text-id">();
const o2 = new Observable<typeof observableId>();
// passing event map without module augmentation
const o3 = new Observable<AnotherEventMap>();
// combining both methods
const o4 = new Observable<"text-id" | AnotherEventMap>();

// now when you use on(), trigger() and other functions
// you will see type hints

o1.on(
    "event",
    (creds: {username: string; password: string}) => true
);
o1.trigger("event", {username: "admin", password: "123"});
o2.trigger("event", "string", true);
o3.trigger("my-event", "string", true);

// You can define event signatures in various ways:

declare module "@kuindji/observable" {
    interface EventMap {
        // using EventMapDefinition is preferable
        // as it also defines "*" event
        // and may define something else in future.
        "observable-id": EventMapDefinition<{
            "event": EventDefinition<
                // trigger arguments signature
                [{ username: string; password: string }],
                // handler return type
                boolean,
                // optional handler signature
                // in case arguments are being transformed
                [type, type]
            >;
        }>;
        [observableId]: {
            "event": EventDefinition<any[], any>,
            "another": {
                triggerArguments: [],
                handlerReturnType: void,
                handlerArguments: []
            }
        }
    }
}

// You may use module declaration multiple times with different observable ids.
// Keep in mind, that once you defined an event map for an observable,
// TS will stop accepting event names that are not defined in this map.

// Type mapping for event sources is not yet supported.
```

### API:

```javascript
// Subscribe to event
// Returns listener id which can be used in un()
o.on(
    /* There is a special event name "*"
     * Listeners of this event will be triggered on any event
     * as receive event name as the first argument.
     *
     * Event names are case sensitive
     */
    /* required */ "eventName",
    /* required */ () => {},
    /* optional */ {
        // "this" object to call listener with
        "context": null,

        /* You can tag a listener */
        "tags": [],

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
        "appendArgs": array || (listener, args) => [],

        // prepend these arguments when calling the listener
        "prependArgs": array || (listener, args) => [],

        // replace with these arguments when calling the listener
        "replaceArgs": array || (listener, args) => [],

        // Run event asynchronously.
        // number = number of milliseconds
        // true = 0ms
        "async": boolean || number
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
// Call listeners until one of them returns true
o.untilTrue(/* required */ "eventName", /* optional */ ...args);
// Call listeners until one of them returns false
o.untilFalse(/* required */ "eventName", /* optional */ ...args);

// Collect data (these may return promise or value depending on what listener returns)
// return raw results from all listeners
const arr = o.raw(/* required */ "eventName", /* optional */ ...args);
// return all results as array and try to resolve promises, if any
const arr = o.all(/* required */ "eventName", /* optional */ ...args);
// merge results from all listeners into one object and try to resolve responses
const obj = o.merge(/* required */ "eventName", /* optional */ ...args);
// merge results from all listeners into one flat array and try to resolve responses
const arr = o.concat(/* required */ "eventName", /* optional */ ...args);
// return first non-empty result
const value = o.firstNonEmpty(/* required */ "eventName", /* optional */ ...args);
// return first result
const value = o.first(/* required */ "eventName", /* optional */ ...args);
// return last result
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

// Get a promise for the next trigger and receive event's payload
await o.promise("eventName");

// Trigger all listeners that are tagged with tagName
o.withTags(["tagName"], () => {
    o.trigger("eventName"); // also works with all,first,resolve etc
});

// Unsubscribe from event
o.un(
    /* required */ "eventName",
    /* required */ () => {},
    /* optional */ context,
    /* optional */ "tagName"
);

// Relay another Observable's event
o.relay(
    /* required */ anotherObservable,
    /* required */ "eventName" || "*",

    // when relaying all events ("*"),
    // use "triggerName" to replace original event names with this single one
    // or "triggerPrefix" to add this prefix to original event name
    /* optional */ "triggerName" || null,
    /* optional */ "triggerPrefix" || null,

    // if proxyType if specified, anotherObservable can use the return values
    // of this observable's listeners via anotherObservable.first()
    // see ProxyType type
    /* optional */ "all" || "first" || "etc, methods of Observable"
);

// Stop relaying events
o.unrelay(
    /* required */ anotherObservable,
    /* required */ "eventName" || "*"
);

// create listener for external event bus
const listener = o.proxy(
    /* required */ "eventNameInThisObservable",
    /* optional */ "all" || "first" || "etc, methods of Observable" // see ProxyType
);

// add proxy to another event bus
o.addEventSource({
    /* required */ name: "proxyName",
    /* required */ on: (eventName, listener, eventSource, listenerOptions) => {},
    /* required */ un: (eventName, listener, eventSource, tagName) => {},
    /* required */ accepts: ((eventName) => boolean) || boolean,
    /* optional */ proxyType: "all" || "first" || "etc, methods of Observable"
    /* optional */ key: value
});
// check if proxy is already added
o.hasEventSource("proxyName" || eventSourceObject);
// remove proxy to another event bus
o.removeEventSource("proxyName" || eventSourceObject);

o.suspendEvent("eventName");
o.suspendAllEvents();
o.suspendEvent("eventName", true /* with queue */);
o.suspendAllEvents(true /* with queue */);
o.resumeEvent("eventName");
o.resumeAllEvents();
o.isSuspended("eventName");
o.isQueued("eventName");
o.hasQueue(/* optional */ "eventName");
// if event is suspended with queue, all trigger calls will be queued
// and replayed once event is resumed (good for batch() behavior)

// Intercept all triggers and return boolean to allow or disallow
o.intercept(function("eventName", args, returnType, [ "tagName" ]) {
    return boolean;
});
// Stop intercepting
o.stopIntercepting();

// Check if already subscribed
o.has(
    /* optional */ "eventName",
    /* optional */ function || number,
    /* optional */ context,
    /* optional */ "tagName"
);

// Remove all listeners from event
o.removeAllListeners("eventName", /* optional */ "tagName");


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
o.setEventOptions(
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
         * "this" context to call filter() in
         */
        "filterContext": any,
        /**
         * Append parameters
         */
        "appendArgs": array || (listener, args) => [],
        /**
         * Prepend parameters
         */
        "prependArgs": array || (listener, args) => [],
        /**
         * Replace parameters
         */
        "replaceArgs": array || (listener, args) => [],
        /**
         * Call this listener asynchronously. Milliseconds or true|false
         */
        "async": boolean || number,
    }
);

// Public api
const api = o.getPublicApi();
// { on(), un(), once(), has() }
// o.getPublicApi() === o.getPublicApi()

// Remove all event listeners and reset options
o.destroyEvent("eventName");

o.$destroy();
```
