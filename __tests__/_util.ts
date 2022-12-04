
export function listenerFactory(mode:string, log:any[]):Function {
    if (mode === "log-id") {
        return function(id:any) {
            return function() {
                log.push(id);
            };
        };
    }
    else if (mode === "log-arg") {
        return function() {
            return function(arg:any) {
                log.push(arg);
            };
        };
    }
    else if (mode === "log-id-arg") {
        return function(id:any) {
            return function(arg:any) {
                log.push([id, arg]);
            };
        };
    }
    return () => {}
};

export function getPromise(resolveValue:any) {
    return new Promise(function(resolve, reject){
        resolve(resolveValue);
    });
};