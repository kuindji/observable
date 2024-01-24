

export default {

    listenerFactory: function(mode, log) {
        if (mode == "log-id") {
            return (id) => {
                return () => {
                    log.push(id);
                };
            };
        }
        else if (mode == "log-arg") {
            return () => {
                return (arg) => {
                    log.push(arg);
                };
            };
        }
        else if (mode == "log-id-arg") {
            return (id) => {
                return (arg) => {
                    log.push([id, arg]);
                };
            };
        }
        return () => {
            return () => {}
        }
    },

    getPromise: function(resolveValue) {
        return new Promise((resolve) => {
            resolve(resolveValue);
        });
    }
};