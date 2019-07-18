import assertion from './assertion';

/**
 * Ensures is an assertion of a postcondition.
 * It expresses a condition that must be true after the associated class member is executed.
 *
 */
function ensuresDebug<Self>(
    fnCondition: (self: Self, returnValue: any) => boolean,
    message: string = 'Postcondition failed') {
    let assert = assertion(true);

    return function(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        let {value, get, set} = descriptor;

        if(value != undefined) {
            descriptor.value = function (this: Self, ...args: any[]) {
                let result = value.apply(this, args);
                assert(fnCondition(this, result), message);

                return result;
            };
        } else {
            if(get != undefined) {
                descriptor.get = function(this: Self) {
                    let result = get!.apply(this);
                    assert(fnCondition(this, result), message);

                    return result;
                };
            }
            if(set != undefined) {
                descriptor.set = function(this: Self, arg: any) {
                    let result = set!.call(this, arg);
                    assert(fnCondition(this, arg), message);

                    return result;
                };
            }
        }
    };
}

// @ts-ignore: ignoring unused
function ensuresProd<Self>(fnCondition: (self: Self, ...args: any[]) => boolean, message: string = 'Precondition failed') {
    return function(_target: any, _propertyKey: string, _descriptor: PropertyDescriptor) {};
}

/**
 *
 * @param debugMode
 */
export default function(debugMode: boolean) {
    let ensures = debugMode ? ensuresDebug : ensuresProd;

    return ensures;
}