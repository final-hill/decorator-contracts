import Contracts from './';
import AssertionError from './AssertionError';

/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Unit tests for the @invariant decorator
 */

describe('@invariant debug mode', () => {
    let {invariant, ensures, requires} = new Contracts(true);

    test('define invariant', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    @invariant<Stack<any>>(self => 0 <= self.size() && self.size() <= self.maxSize())
    @invariant<Stack<any>>(self => self.isEmpty() == (self.size() == 0))
    class Stack<T> {
        protected _maxSize: number;
        protected _implementation: T[] = [];

        constructor(maxSize: number) {
            this._maxSize = maxSize;
        }

        isEmpty(): boolean {
            return this._implementation.length == 0;
        }

        isFull(): boolean {
            return this._implementation.length == this._maxSize;
        }

        maxSize(): number {
            return this._maxSize;
        }

        @requires<Stack<T>>(self => !self.isEmpty())
        @ensures<Stack<T>>(self => !self.isFull())
        //TODO: @ensures<Stack<T>>(self => self.size() == oldSelf.size() - 1)
        pop(): T {
            return this._implementation.pop()!;
        }

        @requires<Stack<T>>(self => !self.isFull())
        @ensures<Stack<T>>(self => !self.isEmpty())
        // TODO: @ensures<Stack<T>>(self => self.top() === item)
        push(item: T) {
            this._implementation.push(item);
        }

        size(): number {
            return this._implementation.length;
        }

        @requires<Stack<T>>(self => !self.isEmpty())
        top() {
            return this._implementation[this._implementation.length - 1];
        }
    }

    test('Construction does not throw', () => {
        expect(() => {
            let myStack = new Stack<number>(5);
            myStack.push(3);
        }).not.toThrow();
    });

    test('Falsey invariant throws', () => {
        @invariant(self => self instanceof Array)
        class Foo {}

        expect(() => {
            return new Foo();
        }).toThrow(AssertionError);
    });
 });

describe('@invariant prod mode', () => {
    let {invariant, ensures, requires} = new Contracts(false);

    test('define invariant', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    @invariant<Stack<any>>(self => 0 <= self.size() && self.size() <= self.maxSize())
    @invariant<Stack<any>>(self => self.isEmpty() == (self.size() == 0))
    class Stack<T> {
        protected _maxSize: number;
        protected _implementation: T[] = [];

        constructor(maxSize: number) {
            this._maxSize = maxSize;
        }

        isEmpty(): boolean {
            return this._implementation.length == 0;
        }

        isFull(): boolean {
            return this._implementation.length == this._maxSize;
        }

        maxSize(): number {
            return this._maxSize;
        }

        @requires<Stack<T>>(self => !self.isEmpty())
        @ensures<Stack<T>>(self => !self.isFull())
        //TODO: @ensures<Stack<T>>(self => self.size() == oldSelf.size() - 1)
        pop(): T {
            return this._implementation.pop()!;
        }

        @requires<Stack<T>>(self => !self.isFull())
        @ensures<Stack<T>>(self => !self.isEmpty())
        // TODO: @ensures<Stack<T>>(self => self.top() === item)
        push(item: T) {
            this._implementation.push(item);
        }

        size(): number {
            return this._implementation.length;
        }

        @requires<Stack<T>>(self => !self.isEmpty())
        top() {
            return this._implementation[this._implementation.length - 1];
        }
    }

    test('Construction does not throw', () => {
        expect(() => {
            let myStack = new Stack<number>(5);
            myStack.push(3);
        }).not.toThrow();
    });

    test('Falsey invariant is a noop', () => {
        @invariant(self => self instanceof Array)
        class Foo {}

        expect(() => {
            return new Foo();
        }).not.toThrow();
    });
});