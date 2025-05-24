import { Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

@invariant((self: Stack<any>) =>
    self.isEmpty() == (self.size == 0) &&
    self.isFull() == (self.size == self.limit) &&
    self.size >= 0 && self.size <= self.limit
)
class Stack<T> extends Contracted {
    private _implementation: T[] = [];
    private _size = 0;
    private _limit: number;

    constructor(limit: number) {
        super()
        this._limit = limit;
    }

    get limit() { return this._limit; }

    get size(): number { return this._size; }

    clear(): void {
        this._implementation = [];
        this._size = 0;
    }

    isEmpty(): boolean { return this._implementation.length == 0; }
    isFull(): boolean { return this._implementation.length == this.limit; }

    @demands((self: Stack<any>) => !self.isEmpty())
    @ensures((self: Stack<any>, _args, old: Stack<any>) =>
        !self.isFull() && self.size == old.size - 1)
    pop(): T {
        this._size--;

        return this._implementation.pop()!;
    }

    @demands((self: Stack<any>) => !self.isFull())
    @ensures((self, [item], old: Stack<any>) =>
        !self.isEmpty() &&
        self.top === item &&
        self.size === old.size + 1
    )
    push(item: T): void {
        this._size++;
        this._implementation.push(item);
    }

    @demands((self: Stack<any>) => !self.isEmpty())
    top(): T {
        return this._implementation[this._implementation.length - 1];
    }
}

describe('Testing Stack', () => {
    test('Creating stack', () => {
        nodeAssert.doesNotThrow(() => Stack.new(3));
        nodeAssert.throws(() => Stack.new(-1));
    });

    test('popping empty stack throws', () => {
        const myStack = Stack.new(3);
        nodeAssert.throws(() => myStack.pop(), /^Error: No demands were satisfied/);
    });
});