

function async(fn:Function, context:any = null, args:any[] = [], timeout:number = 0) {
    return setTimeout(() => fn.apply(context, args), timeout);
};

export default async