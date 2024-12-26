import { assert } from 'chai';
import { EventEmitter } from 'events';
import Observable, { ProxyType } from '../dist/index';
import util from './util';

describe('Observable', function () {
    it('should relay other events', () => {
        const o1 = new Observable();
        const o2 = new Observable();
        const triggered = [];
        const l = util.listenerFactory('log-id', triggered);

        o1.relay(o2, 'event');
        o1.on('event', l(1));
        o2.on('event', l(2));
        o2.trigger('event');

        o1.unrelay(o2, 'event');
        o2.trigger('event');

        assert.deepStrictEqual([1, 2, 2], triggered);
    });

    it('should relay * events', () => {
        const o1 = new Observable();
        const o2 = new Observable();
        const triggered = [];
        const l = util.listenerFactory('log-id', triggered);

        o1.relay(o2, '*');
        o1.on('event1', l(1));
        o1.on('event2', l(2));
        o2.trigger('event1');
        o2.trigger('event2');

        assert.deepStrictEqual([1, 2], triggered);
    });

    it('should relay * events with prefix', () => {
        const o1 = new Observable();
        const o2 = new Observable();
        const triggered = [];
        const l = util.listenerFactory('log-id', triggered);

        o1.relay(o2, '*', null, 'pfx-');
        o1.on('pfx-event1', l(1));
        o1.on('pfx-event2', l(2));
        o2.trigger('event1');
        o2.trigger('event2');

        assert.deepStrictEqual([1, 2], triggered);
    });

    it('should pass results back to relay', () => {
        const o1 = new Observable();
        const o2 = new Observable();

        o1.relay(o2, 'event', null, null, ProxyType.ALL);
        o1.on('event', () => 1);
        o1.on('event', () => 2);
        const res = o2.first('event');

        assert.deepStrictEqual([1, 2], res);
    });

    it('should relay from external event buses', () => {
        const o = new Observable();
        const ee = new EventEmitter();
        let triggered = true;
        let params: any[] = [];

        ee.on('event-source', o.proxy('event-target'));
        o.on('event-target', (a: any, b: any) => {
            params.push(a);
            params.push(b);
            triggered = true;
        });

        ee.emit('event-source', 1, 2);

        assert.deepStrictEqual([1, 2], params);
        assert(triggered === true);
    });

    it('should suspend and resume events', () => {
        const o = new Observable();
        const triggered: number[] = [];
        const l = function () {
            triggered.push(1);
        };

        o.on('event', l);
        o.trigger('event');
        o.suspendEvent('event');
        o.trigger('event');
        o.resumeEvent('event');
        o.trigger('event');
        o.suspendAllEvents();
        o.trigger('event');
        o.resumeAllEvents();
        o.trigger('event');

        assert.deepStrictEqual([1, 1, 1], triggered);
    });

    it('should return correct suspended state', () => {
        const o = new Observable();

        o.setEventOptions('event1');
        o.setEventOptions('event2');
        o.setEventOptions('event3');

        o.suspendEvent('event1');
        o.suspendEvent('event2', true);

        assert(o.isSuspended('event1'));
        assert(!o.isQueued('event1'));

        assert(o.isSuspended('event2'));
        assert(o.isQueued('event2'));

        assert(!o.isSuspended('event3'));
        assert(!o.isQueued('event3'));
    });

    it('should suspend and resume events with queue', () => {
        const o = new Observable();
        const triggered: number[] = [];
        const l = function () {
            triggered.push(1);
        };

        o.on('event', l);
        o.trigger('event');
        o.suspendEvent('event', true);
        o.trigger('event');
        o.trigger('event');
        o.resumeEvent('event');

        assert.deepStrictEqual([1, 1, 1], triggered);
    });

    it('intercept events', () => {
        const o = new Observable();
        const triggered: number[] = [];
        const events: string[] = [];
        const args: number[] = [];
        const l = function (arg) {
            triggered.push(arg);
        };
        const interceptor = function (event, a) {
            events.push(event);
            args.push(a[0]);
            return false;
        };

        o.on('event', l);
        o.trigger('event', 1);
        o.intercept(interceptor);
        o.trigger('event', 2);

        assert.deepStrictEqual([1], triggered);
        assert.deepStrictEqual([2], args);
        assert.deepStrictEqual(['event'], events);
    });

    it('should indicate if it has a listener or not', () => {
        const o = new Observable();
        const context = {
            l: function () {},
            l2: function () {},
        };
        const l = function () {};

        o.setEventOptions('event');
        o.setEventOptions('event2');
        o.on('event', l);
        o.on('event', context.l, { context });

        assert(o.has());
        assert(o.has('event'));
        assert(!o.has('event2'));
        assert(!o.has('event3'));

        assert(o.has('event', l));
        assert(o.has('event', context.l, context));
        assert(!o.has('event', context.l2));

        assert(!o.has('event2', l));

        o.removeAllListeners('event');
        assert(!o.has());
        assert(!o.has('event'));
        assert(!o.has('event', l));
        assert(!o.has('event', context.l));
    });

    it('should create a public api', () => {
        const o = new Observable();
        const api = o.getPublicApi();
        let triggered: boolean = false;
        api.on('event', () => (triggered = true));
        o.trigger('event');

        assert(triggered);
    });

    it('should work with tags', () => {
        const o = new Observable();
        const triggered: number[] = [];
        const a = () => triggered.push(1);
        const b = () => triggered.push(2);
        const c = () => triggered.push(3);

        o.on('event', a, { tags: ['a'] });
        o.on('event', b, { tags: ['b'] });
        o.on('event', c, { tags: ['a', 'b'] });

        o.withTags(['a'], () => o.trigger('event'));
        assert.deepStrictEqual([1, 3], triggered);
        o.trigger('event');
        assert.deepStrictEqual([1, 3, 1, 2, 3], triggered);

        assert(o.has('event', null, null, 'a'));
        assert(!o.has('event', null, null, 'c'));
        assert(o.has('event', a, null, 'a'));
        assert(!o.has('event', b, null, 'a'));

        o.un('event', a, null, 'a');
        o.un('event', b, null, 'a');

        assert(!o.has('event', a, null, 'a'));
        assert(o.has('event', b));
        assert(o.has('event', null, null, 'a'));

        o.removeAllListeners('event', 'a');
        assert(!o.has('event', c));
    });
});
