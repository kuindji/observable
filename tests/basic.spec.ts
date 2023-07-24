import { assert } from "chai"
import Observable from "../src/index"
import util from "./util"

describe("Observable", () => {
    it("triggers basic event", () => {
        const o = new Observable;
        const triggered = [];
        let arg = 0;
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", (value) => {
            arg = value;
        });
        o.on("event", l("first"));
        o.on("event", l("second"));
        o.trigger("event", 1);

        assert.equal(1, arg);
        assert.deepStrictEqual(["first", "second"], triggered);
    });

    it("triggers listeners in right order", () => {
        const o = new Observable;
        const triggered = [];
        const l = util.listenerFactory("log-id", triggered);

        o.on("event", l(1));
        o.on("event", l(2));
        o.on("event", l(3), {first: true});
        o.trigger("event");

        assert.deepStrictEqual([3,1,2], triggered);
    });
});