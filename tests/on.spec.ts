import { assert } from "chai"
import Observable from "../dist/index"
import util from "./util"

describe("Observable", () => {

    it("should respect listener's append and prepend arguments", () => {

        const o = new Observable;

        const l = (saveIn) => {
            return (...args) => {
                args.forEach(arg => saveIn.push(arg));
            };
        };

        const appended = [], prepended = [];

        o.on("event", l(appended), { appendArgs: [1,2] });
        o.on("event", l(prepended), { prependArgs: [3,4] });

        o.trigger("event", "!");

        assert.deepStrictEqual([3, 4, "!"], prepended);
        assert.deepStrictEqual(["!", 1, 2], appended);
    });

    it("should respect event's append and prepend arguments", () => {

        const o = new Observable;

        o.createEvent("event", {
            prependArgs: [1,2],
            appendArgs: [3,4]
        })

        const l = (saveIn) => {
            return (...args) => {
                args.forEach(arg => saveIn.push(arg));
            };
        };

        const args = [];

        o.on("event", l(args));
        o.trigger("event", "!");

        assert.deepStrictEqual([1,2, "!", 3, 4], args);
    });

    it("should respect listener's replaceArgs argument", () => {

        const o = new Observable;

        const l = (saveIn) => {
            return (...args) => {
                args.forEach(arg => saveIn.push(arg));
            };
        };

        const args = [];

        o.on("event", l(args), { replaceArgs: [1,2] });
        o.trigger("event", "!");

        assert.deepStrictEqual([1, 2], args);
    });

    it("should respect listener's first option", () => {

        const o = new Observable;
        const triggered = [];
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", l(1));
        o.on("event", l(2), { first: true });
        o.trigger("event");

        assert.deepStrictEqual([2, 1], triggered);
    });

    it("should respect listener's alwaysFirst option", () => {

        const o = new Observable;
        const triggered = [];
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", l(1));
        o.on("event", l(2), { alwaysFirst: true });
        o.on("event", l(3), { first: true });
        o.trigger("event");

        assert.deepStrictEqual([2, 3, 1], triggered);
    });

    it("should respect listener's alwaysLast option", () => {

        const o = new Observable;
        const triggered = [];
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", l(1));
        o.on("event", l(2), { alwaysLast: true });
        o.on("event", l(3));
        o.trigger("event");

        assert.deepStrictEqual([1, 3, 2], triggered);
    });

    it("should respect event's replaceArgs argument", () => {

        const o = new Observable;

        o.createEvent("event", {
            replaceArgs: [1, 2]
        })
        const l = (saveIn) => {
            return (...args) => {
                args.forEach(arg => saveIn.push(arg));
            };
        };

        const args = [];

        o.on("event", l(args));
        o.trigger("event", "!");

        assert.deepStrictEqual([1, 2], args);
    });

    it("should respect start and limit options", () => {

        const o = new Observable;
        const triggered = [];
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", l(1), {limit: 2});
        o.on("event", l(2), {start: 3});

        o.trigger("event");
        o.trigger("event");
        o.trigger("event");
        o.trigger("event");

        assert.deepStrictEqual([1,1,2,2], triggered);
    });

    it("should respect event's limit option", () => {

        const o = new Observable;
        o.createEvent("event", {
            limit: 2
        })
        const triggered = [];
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", l(1));

        o.trigger("event");
        o.trigger("event");
        o.trigger("event");
        o.trigger("event");

        assert.deepStrictEqual([1,1], triggered);
    });

    it("should respect given context and control dupes", () => {
        
        const o = new Observable;
        const triggered: any[] = [];
        const context = {
            a: 1,
            b: 2,
            l: function() {
                triggered.push(this.a);
            },
            d: function() {
                triggered.push(this.b);
            }
        };

        o.on("event", context.l, { context });
        o.on("event", context.l, { context });
        o.on("event", context.d, { context });

        o.trigger("event");

        assert.deepStrictEqual([1, 2], triggered);
    });

    it("should run listeners asynchronously when asked", (done) => {
        const o = new Observable;
        o.on("event", done, {async: 100});
        o.trigger("event");
    });

    it("should unsubscribe from event", () => {

        const o = new Observable;
        const triggered: number[] = [];
        const l = () => triggered.push(1);
        o.on("event", l);
        o.trigger("event");
        o.un("event", l);
        o.trigger("event");

        assert.deepStrictEqual([1], triggered);
    });

    it("should unsubscribe dupes correctly", () => {

        let res = 0;
        const SomeClass = class {
            handler() {
                res++;
            }
        }

        const h1 = new SomeClass,
            h2 = new SomeClass,
            h3 = new SomeClass,
            o = new Observable;

        o.on("event", h1.handler, { context: h1 });
        o.on("event", h2.handler, { context: h2 });
        o.on("event", h3.handler, { context: h3 });

        o.trigger("event");
        o.un("event", h3.handler, h3);
        o.trigger("event");

        assert.strictEqual(5, res, "handlers should've been called 5 times");
    });

    it("wait for first trigger", (done) => {
        const o = new Observable;
        o.promise("event").then((payload) => {
            assert(payload === 1);
            done();
        });
        setTimeout(() => o.trigger("event", 1), 50);
    });
});

