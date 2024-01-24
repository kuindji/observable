
export default function isPromise(obj: any) {

    if (obj instanceof Promise) {
        return true;
    }

    if (typeof obj !== "object") {
        return false;
    }

    return !!obj.then && typeof obj.then === "function";
}