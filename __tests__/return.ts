import Observable from "../src/Observable"


describe("Return result", () => {

    test("all", () => {
        const o = new Observable;
        o.createEvent("event", "all");
        o.on("event", () => 1);
        o.on("event", () => 2);
        const res = o.trigger("event");

        expect(res).toEqual([1,2]);
    });

    test("first", () => {
        const o = new Observable;
        let triggered = false;
        o.createEvent("event", "first");
        o.on("event", () => 1);
        o.on("event", () => { triggered = true; return 2; });
        const res = o.trigger("event");

        expect(res).toBe(1);
        expect(triggered).toBe(false);
    });

    test("false", () => {
        const o = new Observable;
        let triggered = false;
        o.createEvent("event", false);
        o.on("event", () => false);
        o.on("event", () => { triggered = true; return 2; });
        const res = o.trigger("event");

        expect(res).toBe(false);
        expect(triggered).toBe(false);
    });

    test("true", () => {
        const o = new Observable;
        let triggered = false;
        o.createEvent("event", true);
        o.on("event", () => true);
        o.on("event", () => { triggered = true; return 2; });
        const res = o.trigger("event");

        expect(res).toBe(true);
        expect(triggered).toBe(false);
    });

    test("concat", () => {
        const o = new Observable;
        o.createEvent("event", "concat");
        o.on("event", () => [1]);
        o.on("event", () => [2]);
        const res = o.trigger("event");

        expect(res).toEqual([ 1, 2 ]);
    });

    test("merge", () => {
        const o = new Observable;
        o.createEvent("event", "merge");
        o.on("event", () => ({ a: 1 }));
        o.on("event", () => ({ b: 2 }));
        const res = o.trigger("event");

        expect(res).toEqual({ a: 1, b: 2 });
    });

    test("nonempty", () => {
        const o = new Observable;
        let triggered = false;
        o.createEvent("event", "nonempty");
        o.on("event", () => {});
        o.on("event", () => 1);
        o.on("event", () => { triggered = true });
        const res = o.trigger("event");

        expect(res).toBe(1);
        expect(triggered).toBe(false);
    });

    test("last", () => {
        const o = new Observable;
        o.createEvent("event", "last");
        o.on("event", () => 3);
        o.on("event", () => 2);
        o.on("event", () => 1);
        const res = o.trigger("event");

        expect(res).toBe(1);
    });

    test("pipe", () => {
        const o = new Observable;
        o.createEvent("event", "pipe");
        o.on("event", (value:number) => value + value);
        o.on("event", (value:number) => value * value);
        const res = o.trigger("event", 1);

        expect(res).toBe(4);
    });
});
