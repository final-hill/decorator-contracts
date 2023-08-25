/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Contract, Contracted, invariant } from '../';

interface StackType<T> {
    readonly limit: number;
    readonly size: number;
    clear(): void;
    isEmpty(): boolean;
    isFull(): boolean;
    pop(): T;
    push(item: T): void;
    top(): T;
}

const stackContract = new Contract<StackType<any>>({
    [invariant](self) {
        return self.isEmpty() == (self.size == 0) &&
            self.isFull() == (self.size == self.limit) &&
            self.size >= 0 && self.size <= self.limit;
    },
    pop: {
        demands(self) { return !self.isEmpty(); },
        ensures(self, old) {
            return !self.isFull() &&
                self.size == old.size - 1;
        }
    },
    push: {
        demands(self) { return !self.isFull(); },
        ensures(self, old, item) {
            return !self.isEmpty() &&
                self.top === item &&
                self.size === old.size + 1;
        }
    },
    top: {
        demands(self) {
            return !self.isEmpty();
        }
    }
});

@Contracted(stackContract)
class Stack<T> implements StackType<T> {
    #implementation: T[] = [];
    #size = 0;
    #limit: number;

    constructor(limit: number) {
        this.#limit = limit;
    }

    get limit() {
        return this.#limit;
    }

    get size(): number {
        return this.#size;
    }

    clear(): void {
        this.#implementation = [];
        this.#size = 0;
    }

    isEmpty(): boolean {
        return this.#implementation.length == 0;
    }

    isFull(): boolean {
        return this.#implementation.length == this.limit;
    }

    pop(): T {
        this.#size--;

        return this.#implementation.pop()!;
    }

    push(item: T): void {
        this.#size++;
        this.#implementation.push(item);
    }

    top(): T {
        return this.#implementation[this.#implementation.length - 1];
    }
}

describe('Testing Stack', () => {
    test('Creating stack', () => {
        expect(() => new Stack(3)).not.toThrow();
        expect(() => new Stack(-1)).toThrow();
    });

    test('popping empty stack throws', () => {
        const myStack = new Stack(3);

        expect(() => myStack.pop()).toThrow(/^demands not met/);
    });
});