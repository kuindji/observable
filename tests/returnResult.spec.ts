import { assert } from 'chai';
import Observable from '../dist/index';

describe('Observable', function () {
    describe('returnResult', function () {
        it('all', function () {
            const o = new Observable();
            o.on('event', () => 1);
            o.on('event', () => 2);
            const res = o.all('event');
            assert.deepStrictEqual([1, 2], res);
        });

        it('first', function () {
            const o = new Observable();
            let triggered = false;
            o.on('event', () => 1);
            o.on('event', () => {
                triggered = true;
                return 2;
            });
            const res = o.first('event');
            assert.equal(1, res);
            assert(!triggered);
        });

        it('false', function () {
            const o = new Observable();
            let firstTriggered = false;
            let secondTriggered = false;
            o.on('event', () => {
                firstTriggered = true;
                return false;
            });
            o.on('event', () => {
                secondTriggered = true;
                return 2;
            });
            o.untilFalse('event');
            assert(firstTriggered);
            assert(!secondTriggered);
        });

        it('true', function () {
            const o = new Observable();
            let firstTriggered = false;
            let secondTriggered = false;
            o.on('event', () => {
                firstTriggered = true;
                return true;
            });
            o.on('event', () => {
                secondTriggered = true;
                return 2;
            });
            o.untilTrue('event');
            assert(firstTriggered);
            assert(!secondTriggered);
        });

        it('concat', function () {
            const o = new Observable();
            o.on('event', () => [1]);
            o.on('event', () => [2]);
            const res = o.concat('event');
            assert.deepStrictEqual([1, 2], res);
        });

        it('merge', function () {
            const o = new Observable();
            o.on('event', () => ({ a: 1 }));
            o.on('event', () => ({ b: 2 }));
            const res = o.merge('event');
            assert.deepStrictEqual({ a: 1, b: 2 }, res);
        });

        it('nonempty', function () {
            const o = new Observable();
            let triggered = false;
            o.on('event', () => {});
            o.on('event', () => 1);
            o.on('event', () => {
                triggered = true;
            });
            const res = o.firstNonEmpty('event');
            assert.equal(1, res);
            assert(!triggered);
        });

        it('last', function () {
            const o = new Observable();
            o.on('event', () => 3);
            o.on('event', () => 2);
            o.on('event', () => 1);
            const res = o.last('event');
            assert.equal(1, res);
        });

        it('pipe', function () {
            const o = new Observable();
            o.on('event', (value) => value + value);
            o.on('event', (value) => value * value);
            const res = o.pipe('event', 1);
            assert.equal(4, res);
        });

        it('raw', function () {
            const o = new Observable();
            o.on('event', () => new Promise((resolve) => resolve(1)));
            o.on('event', () => 2);
            const res = o.raw('event');
            assert(res[0] instanceof Promise);
            assert(res[1] === 2);
        });
    });
});
