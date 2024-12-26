import { assert } from 'chai';
import Observable from '../dist/index';

describe('Auto trigger', () => {
    it('should be triggered after subscription', () => {
        const o = new Observable();
        let res;
        o.setEventOptions('event', { autoTrigger: true });
        o.trigger('event', 1);
        o.on('event', (value) => {
            res = value;
        });

        assert(res === 1);
    });
});
