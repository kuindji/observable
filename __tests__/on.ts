
import Observable from "../src/Observable"
import { listenerFactory } from "./_util"


describe("Observable", function(){

    test("should append and prepend arguments", function(){

        const o = new Observable;
        const appended:any[] = [];
        const prepended:any[] = [];
        const l = (saveIn:any[]) => {
            return function(...args:any[]) {
                args.forEach((arg) => saveIn.push(arg));
            };
        };

        o.on("event", l(appended), { append: [1,2] });
        o.on("event", l(prepended), { prepend: [3,4] });
        o.trigger("event", "!");

        expect(prepended).toEqual([3, 4, "!"]);
        expect(appended).toEqual(["!", 1, 2]);
    });

    test("should respect start and limit options", function(){

        const o = new Observable;
        const triggered:any[] = [];
        const l = listenerFactory("log-id", triggered);

        o.on("event", l(1), { limit: 2 });
        o.on("event", l(2), { start: 3 });

        o.trigger("event");
        o.trigger("event");
        o.trigger("event");
        o.trigger("event");

        expect(triggered).toEqual([1,1,2,2]);
    });

    test("should respect given context and control dupes", function(){
        
        const o = new Observable;
        const triggered:any[] = [];
        const context = {
            a: 1,
            b: 2,
            l: function(){
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

        expect(triggered).toEqual([ 1, 2 ]);
    });

    test("should run listeners asynchronously when asked", (done) => {
        const o = new Observable;
        o.on("event", done, { async: 100 });
        o.trigger("event");
    });

    test("should unsubscribe from event", () => {

        const o = new Observable;
        const triggered:any[] = [];
        const l = function(){
            triggered.push(1);
        };

        o.on("event", l);
        o.trigger("event");
        o.un("event", l);
        o.trigger("event");

        expect(triggered).toEqual([ 1 ]);
    });

    test("should unsubscribe dupes correctly", () => {

        let res = 0;
        const SomeClass = class {
            handler() {
                res++;
            }
        };

        const   h1 = new SomeClass,
                h2 = new SomeClass,
                h3 = new SomeClass,
                o = new Observable;

        o.on("event", h1.handler, { context: h1 });
        o.on("event", h2.handler, { context: h2 });
        o.on("event", h3.handler, { context: h3 });

        o.trigger("event");
        o.un("event", h3.handler, h3);
        o.trigger("event");

        expect(res).toBe(5);
    });
});

