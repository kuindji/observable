export default function tagsIntersect(t1: string[], t2: string[]): boolean {
    for (const tag of t1) {
        if (t2.indexOf(tag) !== -1) {
            return true;
        }
    }
    return false;
}
