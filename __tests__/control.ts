import Observable from "../src/Observable"
import { listenerFactory } from "./_util"


describe("Observable", function(){

    test("should relay other events", () => {

        const o1 = new Observable;
        const o2 = new Observable;
        const triggered:any[] = [];
        const l = listenerFactory("log-id", triggered);

        o1.relayEvent(o2, "event");
        o1.on("event", l(1));
        o2.on("event", l(2));
        o2.trigger("event");

        o1.unrelayEvent(o2, "event");
        o2.trigger("event");

        expect(triggered).toEqual([1, 2, 2]);
    });

    test("should relay * events", () => {

        const o1 = new Observable;
        const o2 = new Observable;
        const triggered:any[] = [];
        const l = listenerFactory("log-id", triggered);

        o1.relayEvent(o2, "*");
        o1.on("event1", l(1));
        o1.on("event2", l(2));
        o2.trigger("event1");
        o2.trigger("event2");

        expect(triggered).toEqual([1, 2]);
    });

    test("should relay * events with prefix", () => {

        const o1 = new Observable;
        const o2 = new Observable;
        const triggered:any[] = [];
        const l = listenerFactory("log-id", triggered);

        o1.relayEvent(o2, "*", null, "pfx-");
        o1.on("pfx-event1", l(1));
        o1.on("pfx-event2", l(2));
        o2.trigger("event1");
        o2.trigger("event2");

        expect(triggered).toEqual([1, 2]);
    });

    test("should suspend and resume events", () => {
        const o = new Observable;
        const triggered:any[] = [];
        const l = () => triggered.push(1);

        o.on("event", l);
        o.trigger("event");
        o.suspendEvent("event");
        o.trigger("event");
        o.resumeEvent("event");
        o.trigger("event");
        o.suspendAllEvents();
        o.trigger("event");
        o.resumeAllEvents();
        o.trigger("event");

        expect(triggered).toEqual([1,1,1]);
    });

    test("should indicate if it has a listener or not", () => {
        const o = new Observable;
        const context = {
            l: () => {},
            l2: () => {}
        };
        const l = () => {};

        o.createEvent("event");
        o.createEvent("event2");
        o.on("event", l);
        o.on("event", context.l, { context });

        expect(o.hasListener()).toBe(true);
        expect(o.hasListener("event")).toBe(true);
        expect(o.hasListener("event2")).toBe(false);
        expect(o.hasListener("event3")).toBe(false);

        expect(o.hasListener("event", l)).toBe(true);
        expect(o.hasListener("event", context.l, context)).toBe(true);
        expect(o.hasListener("event", context.l2, context)).toBe(false);

        expect(o.hasListener("event2", l)).toBe(false);

        expect(o.hasEvent("event")).toBe(true);
        expect(o.hasEvent("event3")).toBe(false);

        o.removeAllListeners("event");
        expect(o.hasListener()).toBe(false);
        expect(o.hasListener("event")).toBe(false);
        expect(o.hasListener("event", l)).toBe(false);
        expect(o.hasListener("event", context.l, context)).toBe(false);
    });
});