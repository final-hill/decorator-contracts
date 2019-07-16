import requiresFactory from "./requires";

let debugRequires = requiresFactory(true),
    prodRequires = requiresFactory(false)

describe('Test preconditions', () => {
    class Stack<T> {
        private _size: number

        private _implementation: T[] = []

        constructor(size: number) {
            this._size = size
        }

        get size(): number {
            return this._size
        }

        isEmpty(): boolean {
            return this._size === 0
        }

        isFull(): boolean {
            return this._size == this._implementation.length
        }

        peek(): T {
            return this._implementation[this._implementation.length - 1]
        }

        pop(): T {
            return this._implementation.pop()
        }

        push(value: T) {
            this._implementation.push(value)
        }
    }

    // FIXME: does jest not support decorators?
    /*
    test('Define preconditions', () => {
        let requires = debugRequires

        class MyStack<T> extends Stack<T> {

            @requires((self: MyStack<T>, value: T) => !self.isFull())
            push(value: T) {
                super.push(value)
            }

            @requires((self: MyStack<T>) => !self.isEmpty())
            pop(): T {
                return super.pop()
            }

            @requires((self: MyStack<T>) => !self.isEmpty())
            peek(): T {
                return super.peek()
            }
        }
    }) */
})