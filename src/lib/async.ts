
export default function async(
    fn: (...args: any[]) => any, 
    context?: object, 
    args?: any[], 
    timeout?: number): Promise<any> {

    return new Promise((resolve, reject) => {
        setTimeout(
            () => {
                try {
                    resolve(fn.apply(context, args || []))
                }
                catch (err) {
                    reject(err)
                };
            }, 
            timeout || 0
        );
    });
}