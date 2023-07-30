import { assert } from "chai"
import { EventEmitter } from "events"
import Observable from "../dist/index"


describe("Event source", () => {

    it("should subscribe using accepts", () => {
        const em = new EventEmitter;
        const o = new Observable;
        o.addEventSource({
            name: "ev",
            accepts: (name) => name === "should",
            on: (name, fn) => em.on(name, fn),
            un: (name, fn) => em.off(name, fn)
        });

        let triggered = 0;
        const listener1 = () => triggered++;
        const listener2 = () => triggered++;
        o.on("should", listener1);
        o.on("shouldnt", listener2);
        em.emit("should");
        em.emit("shouldnt");
        o.un("should", listener1);
        o.un("shouldnt", listener2);
        em.emit("should");
        em.emit("shouldnt");

        assert(triggered === 1);
    });

    it("destroy eventSource and unsubscribe", () => {
        const em = new EventEmitter;
        const o = new Observable;
        o.addEventSource({
            name: "ev",
            accepts: () => true,
            on: (name, fn) => em.on(name, fn),
            un: (name, fn) => em.off(name, fn)
        });

        let triggered = 0;
        const listener = () => triggered++;
        o.on("event", listener);
        em.emit("event");
        o.removeEventSource("ev");
        em.emit("event");

        assert(triggered === 1);
    });
    
})