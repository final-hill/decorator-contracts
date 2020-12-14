/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

const invariant = Symbol('invariant');

type Constructor<T> = new (...args: any[]) => T;
type NonFunctionPropertyNames<T extends object> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];
type Properties<T extends object> = Pick<T, NonFunctionPropertyNames<T>>;

type Invariant<T extends object> = (self: T) => boolean;
type Demands<T extends object,F extends T[any]> = (self: T, ...args: Parameters<F>) => boolean;
type Ensures<T extends object,F extends T[any]> = (self: T, old: Properties<T>, ...args: Parameters<F>) => boolean;
type Rescue<T extends object,F extends T[any]> = (self: T, error: Error, args: Parameters<F>, retry: (...args: Parameters<F>) => void) => void;

interface FeatureContract<T extends object, F> {
    demands?: Demands<T,F> | Demands<T,F>[];
    ensures?: Ensures<T,F> | Ensures<T,F>[];
    rescue?: Rescue<T,F> | Rescue<T,F>[];
}

type IContractOptions<T extends object> = {
    [invariant]?: Invariant<T> | Invariant<T>[];
} & {
    [K in keyof T]?: FeatureContract<T, T[K]>
};

class Contract<T extends object> {
    constructor(cfg: IContractOptions<T>){}
}

/**
 * Apply Object.freeze recursively
 * @param {object} object -
 */
function deepFreeze(object: object): void {
    // Freeze properties before freezing self
    for (const [,value] of Object.entries(object)) {
        if (value != undefined && typeof value === 'object') {
            deepFreeze(value);
        }
    }
}

function override(){}

const contractHandler = {};

/**
 *
 * @param contractOptions
 * @param Base
 */
function Contracted<B extends Constructor<any>>(contractOptions: Contract<any>, Base?: B): B {
    deepFreeze(contractOptions);

    class Contracted extends (Base ?? Object) {
        constructor(...args: any[]) {
            super(...args);

            // Proxy necessary to intercept subclass feature calls
            return new Proxy(this, contractHandler);
        }
    }

    return Contracted as B;
}

//////////
interface IStack<T> {
    readonly limit: number;
    readonly size: number;
    clear(): void;
    isEmpty(): boolean;
    isFull(): boolean;
    pop(): T;
    push(item: T): void;
    top(): T;
}

const stackContract = new Contract<IStack<any>>({
    [invariant]: [
        self => self.isEmpty() == (self.size == 0),
        self => self.isFull() == (self.size == self.limit),
        self => self.size >= 0 && self.size <= self.limit
    ],
    pop: {
        demands: self => !self.isEmpty(),
        ensures: (self,old) => self.size == old.size - 1,
        rescue(self, error, args, retry) {
            console.error(error);
            console.log('Retrying...');
            retry(...args);
        }
    },
    push: {
        ensures: [
            self => !self.isEmpty(),
            (self,old) => self.size == old.size + 1
        ]
    }
});

class Stack<T> extends Contracted(stackContract) implements IStack<T> {
    #implementation: T[] = [];

    constructor(readonly limit: number) { super(); }

    clear(): void {
        this.#implementation = [];
    }

    isEmpty(): boolean {
        return this.#implementation.length == 0;
    }

    isFull(): boolean {
        return this.#implementation.length == this.limit;
    }

    pop(): T {
        return this.#implementation.pop()!;
    }

    push(item: T): void {
        this.#implementation.push(item);
    }

    get size(): number {
        return this.#implementation.length;
    }

    top(): T {
        return this.#implementation[this.#implementation.length - 1];
    }
}