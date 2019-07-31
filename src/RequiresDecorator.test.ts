/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Unit testing for the requires decorator
 */

import RequiresDecorator from './RequiresDecorator';
import AssertionError from './AssertionError';

let requires = new RequiresDecorator(true).requires;
// let prodRequires = requiresFactory(false)

describe('Test preconditions', () => {
    class Stack<T> {
        private _size: number;

        private _implementation: T[] = [];

        constructor(size: number) {
            this._size = size;
        }

        get size(): number {
            return this._size;
        }

        isEmpty(): boolean {
            return this._implementation.length === 0;
        }

        isFull(): boolean {
            return this._size == this._implementation.length;
        }

        peek(): T {
            return this._implementation[this._implementation.length - 1];
        }

        pop(): T {
            return this._implementation.pop()!;
        }

        push(value: T) {
            this._implementation.push(value);
        }
    }

    // @ts-ignore
    let stack: Stack<number>;

    test('Define preconditions', () => {
        class MyStack<T> extends Stack<T> {
            @requires<MyStack<T>>(self => !self.isFull())
            push(value: T) {
                super.push(value);
            }

            @requires<MyStack<T>>(self => !self.isEmpty())
            pop(): T {
                return super.pop();
            }

            @requires<MyStack<T>>(self => !self.isEmpty())
            peek(): T {
                return super.peek();
            }
        }

        let stackPush = Object.getOwnPropertyDescriptor(Stack.prototype, 'push')!;
        let myStackPush = Object.getOwnPropertyDescriptor(MyStack.prototype, 'push')!;
        expect(typeof myStackPush.value).toEqual('function');
        expect(myStackPush.value).not.toBe(stackPush.value);

        let stackPop = Object.getOwnPropertyDescriptor(Stack.prototype, 'pop')!;
        let myStackPop = Object.getOwnPropertyDescriptor(MyStack.prototype, 'pop')!;
        expect(typeof myStackPop.value).toEqual('function');
        expect(myStackPop.value).not.toBe(stackPop.value);

        let stackPeek = Object.getOwnPropertyDescriptor(Stack.prototype, 'peek')!;
        let myStackPeek = Object.getOwnPropertyDescriptor(MyStack.prototype, 'peek')!;
        expect(typeof myStackPeek.value).toEqual('function');
        expect(myStackPeek.value).not.toBe(stackPeek.value);

        stack = new MyStack(3);
    });

    test('Test preconditions', () => {

        expect(() => stack.pop()).toThrow(AssertionError);

        expect(() => stack.push(1)).not.toThrow();
        expect(() => stack.push(2)).not.toThrow();
        expect(() => stack.push(3)).not.toThrow();
        expect(() => stack.push(4)).toThrow(AssertionError);
    });
});