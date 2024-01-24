import { assert } from "chai"
import Observable from "../dist/index"
import util from "./util"

type Opt = {
    triggered: boolean
}

const l1 = (val?) => {
    return () => {
        return util.getPromise(val);
    };
};

const l2 = (val, opt: Opt) => {
    return () => {
        opt.triggered = true; 
        return util.getPromise(val);
    }
};

const l3 = (resolver) => {
    return (value) => {
        return new Promise(function(resolve){
            resolve(resolver(value));
        });
    };
}

describe("Observable", function(){
    describe("async returnResult", function(){
        it("all", function(done){
            const o = new Observable;
            o.on("event", l1(1));
            o.on("event", () => 3);
            o.on("event", l1(2));
            Promise.resolve(o.all("event")).then((res) => {
                assert.deepStrictEqual([1,3,2], res);
                done();
            }).catch(function(reason){
                done(reason);
            });
        });

        it("first", function(done){
            const o = new Observable;
            const opt: Opt = { triggered: false };
            o.on("event", l1(1));
            o.on("event", l2(2, opt));
            Promise.resolve(o.first("event")).then((res) => {
                assert.equal(1, res);
                assert(opt.triggered === false);
                done();
            }).catch(function(reason){
                done(reason);
            });
        });

        it("false", function(done){
            const o = new Observable;
            const opt1: Opt = { triggered: false };
            const opt2: Opt = { triggered: false };
            o.on("event", l2(false, opt1));
            o.on("event", l2(2, opt2));
            Promise.resolve(o.untilFalse("event")).then(() => {
                assert(opt1.triggered === true);
                assert(opt2.triggered === false);
                done();
            }).catch(function(reason){
                done(reason);
            });
        });

        it("true", function(done){
            const o = new Observable;
            const opt1: Opt = { triggered: false };
            const opt2: Opt = { triggered: false };
            o.on("event", l2(true, opt1));
            o.on("event", l2(2, opt2));
            Promise.resolve(o.untilTrue("event")).then(() => {
                assert(opt1.triggered === true);
                assert(opt2.triggered === false);
                done();
            }).catch(function(reason){
                done(reason);
            });
        });

        it("concat", function(done){
            const o = new Observable;
            o.on("event", l1([1]));
            o.on("event", l1([2]));
            Promise.resolve(o.concat("event")).then((res) => {
                assert.deepStrictEqual([1,2], res);
                done();
            })
            .catch(function(reason){
                done(reason);
            });
        });

        it("merge", function(done){
            const o = new Observable;
            o.on("event", l1({a: 1}));
            o.on("event", l1({b: 2}));
            Promise.resolve(o.merge("event")).then(function(res){
                assert.deepStrictEqual({a: 1, b: 2}, res);
                done();
            })
            .catch(function(reason){
                done(reason);
            });
        });

        it("nonempty", function(done){
            const o = new Observable;
            const opt: Opt = { triggered: false };
            o.on("event", l1(undefined));
            o.on("event", l1(1));
            o.on("event", l2(null, opt));
            Promise.resolve(o.firstNonEmpty("event")).then(function(res) {
                assert.equal(1, res);
                assert(opt.triggered === false);
                done();
            })
            .catch(function(reason){
                done(reason);
            });
        });

        it("last", function(done){
            const o = new Observable;
            o.on("event", l1(3));
            o.on("event", l1(2));
            o.on("event", l1(1));
            Promise.resolve(o.last("event")).then(function(res){
                assert.equal(1, res);
                done();
            })
            .catch(function(reason){
                done(reason);
            });
        });

        it("pipe", function(done){
            const o = new Observable;
            o.on("event", l3((value) => value + value));
            o.on("event", value => value + 1);
            o.on("event", l3((value) => value * value));
            o.pipe("event", 1).then(function(res){
                assert.equal(9, res);
                done();
            })
            .catch(function(reason){
                done(reason);
            });
        });

        it("should respect event's async option", function(done){
            const calls: any[] = [];
            const p = new Promise(resolve => {
                const o = new Observable;
                o.createEvent("async", { async: true });
                o.on("async", () => { calls.push(1); return 1; });
                o.on("async", () => { calls.push(2); return 2; });
                o.promise("async").then(() => {
                    setTimeout(resolve, 10);
                })
                o.trigger("async");
                assert.deepStrictEqual([], calls);
            });

            p.then(() => {
                assert.deepStrictEqual([1, 2], calls);
                done();
            });
        });

        it("resolve first", function(done){
            const o = new Observable;
            const opt: Opt = { triggered: false };
            o.on("event", l1(1));
            o.on("event", l2(2, opt));
            o.resolveFirst("event").then((res) => {
                assert.equal(1, res);
                assert(opt.triggered === false);
                done();
            }).catch(function(reason){
                done(reason);
            });
        });

        it("resolve *", function(done){
            const o = new Observable;
            const opt: Opt = { triggered: false };
            o.on("*", l1(1));
            o.on("*", l2(2, opt));
            o.resolveFirst("non-existent-event").then((res) => {
                assert.equal(1, res);
                assert(opt.triggered === false);
                done();
            }).catch(function(reason){
                done(reason);
            });
        });
    });
});