import { assert } from "chai"
import Observable, { Listener } from "../src/index"


describe("Filter", () => {
    it("should be filtered with listener's filter option", () => {

        const o = new Observable();
        const l1res: any[] = [];
        const l2res: any[] = [];
        o.on("event", (value) => l1res.push(value), {
            filter: (params: any[]) => {
                return params[0] === 2;
            }
        });
        o.on("event", (value) => l2res.push(value), {
            filter: (params: any[]) => {
                return params[0] === 1;
            }
        });
        o.trigger("event", 1);
        o.trigger("event", 2);
        

        assert.deepStrictEqual([2], l1res)
        assert.deepStrictEqual([1], l2res)
    })

    it("should be filtered with events's filter option", () => {

        const o = new Observable();
        const l1res: any[] = [];
        o.createEvent("event", {
            filter: (params: any[]) => {
                return params[0] === 2;
            }
        })
        o.on("event", (value) => l1res.push(value));
        o.trigger("event", 1);
        o.trigger("event", 2);

        assert.deepStrictEqual([2], l1res)
    })

    it("should pass listener to event's filter", () => {

        const o = new Observable();
        const lres: any[] = [];
        o.createEvent("event", {
            filter: (params: any[], listener?: Listener) => {
                return !!listener && listener.extraData === 1;
            }
        })
        o.on("event", () => lres.push(1), { extraData: 1 });
        o.on("event", () => lres.push(2), { extraData: 2 });
        o.trigger("event");

        assert.deepStrictEqual([1], lres)
    })
})