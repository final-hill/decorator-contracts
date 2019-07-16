import assertion from './assertion'

let assert = assertion(true)

function invariantDebug<Self>(
    fnCondition: (self: Self) => boolean,
    message: string = 'Invariant violated'){
    return function<T extends {new(...args:any[]):{}}>(Constructor:T) {
        let InvariantClass = class extends Constructor {
            constructor(...args: any[]){
                super(...args)
                assert(fnCondition(this as any), message)
            }
        }

        // TODO: decorate every member
        const props = Object.getOwnPropertyDescriptors(Constructor.prototype);

        return InvariantClass
    }
}

function invariantProd(fnCondition: () => boolean, message: string = 'Invariant violated'){
    return function<T extends {new(...args:any[]):{}}>(Constructor:T){

    }
}

export default function(debugMode: boolean) {
    let invariant = debugMode ? invariantDebug : invariantProd
}