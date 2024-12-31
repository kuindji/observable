import { DefaultArgumentsType } from '../types';

export default function async<
    P extends Array<any> = DefaultArgumentsType,
    R = any,
>(
    fn: (...args: P) => R,
    context?: object,
    args?: P,
    timeout?: number,
): Promise<R> {
    return new Promise<R>((resolve, reject) => {
        args = (args || []) as P;
        setTimeout(() => {
            try {
                resolve(fn.apply(context, args as P));
            } catch (err) {
                reject(err);
            }
        }, timeout || 0);
    });
}
