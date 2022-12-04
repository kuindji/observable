import Observable from "../src/Observable"
import { getPromise } from "./_util"

function getObs(rr:string|boolean) {
    const o = new Observable;
    o.createEvent("event", {
        returnResult: rr,
        expectPromises: true,
        resolvePromises: true
    });
    return o;
};

function l1(val:any = null) {
    return () => getPromise(val);
};

function l2(val:any) {
    return () => getPromise(val);
};

function l3(resolver:Function) {
    return (value:any) => {
        return new Promise(function(resolve, reject){
            resolve(resolver(value));
        });
    };
};


describe("Async returnResult", () => {

    test("all", (done) => {
        const o = getObs("all");
        o.on("event", l1(1));
        o.on("event", l1(2));
        o.trigger("event")
            .then((res:number[]) => expect(res).toEqual([ 1, 2 ]))
            .then(done);
    });

    test("first", (done) => {
        const o = getObs("first");
        o.on("event", l1(1));
        o.on("event", l2(2));
        o.trigger("event")
            .then((res:number) => expect(res).toBe(1))
            .then(done);
    });

    test("false", (done) => {
        const o = getObs(false);
        o.on("event", l1(false));
        o.on("event", l2(2));
        o.trigger("event")
            .then((res:boolean) => expect(res).toBe(false))
            .then(done);
    });

    test("true", (done) => {
        const o = getObs(true);
        o.on("event", l1(true));
        o.on("event", l2(2));
        o.trigger("event")
            .then((res:boolean) => expect(res).toBe(true))
            .then(done);
    });

    test("concat", (done) => {
        const o = getObs("concat");
        o.on("event", l1([1]));
        o.on("event", l1([2]));

        o.trigger("event")
            .then((res:number[]) => expect(res).toEqual([ 1, 2 ]))
            .then(done);
    });

    test("merge", (done) => {
        const o = getObs("merge");
        o.on("event", l1({a: 1}));
        o.on("event", l1({b: 2}));
        o.trigger("event")
            .then((res:any) => expect(res).toEqual({ a: 1, b: 2 }))
            .then(done);
    });

    test("nonempty", (done) => {
        const o = getObs("nonempty");
        o.on("event", l1());
        o.on("event", l1(1));
        o.on("event", l2(null));
        o.trigger("event")
            .then((res:number) => expect(res).toBe(1))
            .then(done);
    });

    test("last", (done) => {
        const o = getObs("last");
        o.on("event", l1(3));
        o.on("event", l1(2));
        o.on("event", l1(1));
        o.trigger("event")
            .then((res:number) => expect(res).toBe(1))
            .then(done);
    });

    test("pipe", (done) => {
        const o = getObs("pipe");
        o.on("event", l3((value:number) => value + value));
        o.on("event", l3((value:number) => value * value));
        o.trigger("event", 1)
            .then((res:number) => expect(res).toBe(4))
            .then(done);
    });
});
