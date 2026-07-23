export function info(msg, fields = {}) {
    console.log(JSON.stringify({ level: 'info', msg, ...fields }));
}
export function warn(msg, fields = {}) {
    console.warn(JSON.stringify({ level: 'warn', msg, ...fields }));
}
