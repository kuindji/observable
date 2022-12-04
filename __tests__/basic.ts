import Observable from "../src/Observable"
import { listenerFactory } from "./_util"

describe("Observable", function(){

    test("triggers basic event", () => {
        const o = new Observable;
        const triggered:any[] = [];
        const l:Function = listenerFactory("log-id", triggered);
        let arg:any = 0;

        o.on("event", (value:any) => { arg = value });
        o.on("event", l("first"));
        o.on("event", l("second"));
        o.trigger("event", 1);

        expect(arg).toBe(1);
        expect(triggered).toEqual(["first", "second"]);
    });

    test("triggers listeners in right order", () => {
        const o = new Observable;
        const triggered:any[] = [];
        const l:Function = listenerFactory("log-id", triggered);


        o.on("event", l(1));
        o.on("event", l(2));
        o.on("event", l(3), { first: true });
        o.trigger("event");

        expect(triggered).toEqual([3,1,2]);
    });
});