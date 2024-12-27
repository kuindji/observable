import { Listener, MapKey } from '../types';

function listenerSorter<Id extends MapKey, E extends MapKey>(
    l1: Listener<Id, E>,
    l2: Listener<Id, E>,
): -1 | 0 | 1 {
    const f1 = l1.alwaysFirst === true ? 1 : 0,
        f2 = l2.alwaysFirst === true ? 1 : 0,
        ls1 = l1.alwaysLast === true ? 1 : 0,
        ls2 = l2.alwaysLast === true ? 1 : 0;

    if (f1 === 1 || f2 === 1) {
        return f1 === f2 ? 0 : f1 > f2 ? -1 : 1;
    }
    if (ls1 === 1 || ls2 === 1) {
        return ls1 === ls2 ? 0 : ls1 < ls2 ? -1 : 1;
    }
    return l1.index === l2.index ? 0 : l1.index < l2.index ? -1 : 1;
}

export default listenerSorter;
