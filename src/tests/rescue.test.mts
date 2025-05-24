import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts'

describe('The `rescue` decorator must preserve the invariant after execution', () => {
    @invariant(self => self.value > 0)
    class Base extends Contracted {
        private _value = 3;
        get value() { return this._value; }
        set value(v) { this._value = v; }

        @rescue((self: Base) => self.value = 5)
        method1(): void { throw new Error('I am error'); }
        @rescue((self: Base) => self.value = -1)
        method2(): void { throw new Error('I am error'); }
    }

    test('test', () => {
        const base = Base.new();
        nodeAssert.throws(() => base.method1(), { message: 'I am error' });
        nodeAssert.strictEqual(base.value, 5);
        nodeAssert.throws(() => {
            base.method2();
        }, /^Error: Invariant violated/);
        nodeAssert.throws(() => base.value, /^Error: Invariant violated/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/59
 */
describe('Any error thrown by a class feature must be captured by its @rescue', () => {
    test('rescuing non-error method returns normal', () => {
        class Base extends Contracted {
            @rescue(() => { })
            method(): number { return 7; }
        }
        const base = Base.new();

        nodeAssert.strictEqual(base.method(), 7);
    });

    test('rescue of method with an error then retrying returns ok', () => {
        class Base extends Contracted {
            @rescue((_self, _error: any, _args: any[], retry: any) => { retry(3); })
            method(value: number): number {
                if (value <= 0)
                    throw new Error('value must be greater than 0');
                else
                    return value;
            }
        }
        const base = Base.new();
        nodeAssert.strictEqual(base.method(0), 3);
    });

    test('rescue of method with an error then rethrow throws to caller', () => {
        class Base extends Contracted {
            @rescue(() => { throw new Error('Rescue throw') })
            method(): void {
                throw new Error('Method error');
            }
        }
        const base = Base.new();
        try {
            base.method();
            nodeAssert.fail('Expected an error to be thrown');
        } catch (error: any) {
            nodeAssert.strictEqual(error.message, 'Rescue throw');
        }
    });

    test('rescuing non-error getter returns normal', () => {
        class Base extends Contracted {
            @rescue(() => { })
            get value(): number { return 7; }
        }
        const base = Base.new();
        nodeAssert.strictEqual(base.value, 7);
    });

    test('rescuing error getter then retry returns ok', () => {
        class Base extends Contracted {
            private _value = 0;

            @rescue((self: Base, _error, _args, retry: (value) => void) => {
                self.value = 7;
                retry(7);
            })
            get value(): number {
                if (this._value == 0)
                    throw new Error('Bad State');
                else
                    return this._value;
            }
            set value(v: number) {
                this._value = v;
            }
        }
        const base = Base.new();
        nodeAssert.strictEqual(base.value, 7);
    });

    test('rescue of error getter then rethrow throws to caller', () => {
        class Base extends Contracted {
            @rescue(() => { throw new Error('Not Rescued'); })
            get value(): void {
                throw new Error('Not implemented');
            }
        }
        const base = Base.new();
        try {
            const value = base.value;
            nodeAssert.fail(`Expected an error to be thrown when getting value${value}`);
        } catch (error: any) {
            nodeAssert.strictEqual(error.message, 'Not Rescued');
        }
    });

    test('rescuing non-error setter then getting returns normal', () => {
        class Base extends Contracted {
            private _value = NaN;
            get value() { return this._value; }
            @rescue(() => { })
            set value(v) { this._value = v; }
        }
        const base = Base.new();
        base.value = 12;
        nodeAssert.strictEqual(base.value, 12);
    });

    test('rescue of error setter then retry then getting returns ok', () => {
        class Base extends Contracted {
            private _value = NaN;

            get value(): number { return this._value; }
            @rescue((_self, _error, _args, retry: (value) => void) => { retry(0); })
            set value(value: number) {
                if (Number.isNaN(value))
                    throw new Error('NaN not allowed');

                this._value = value;
            }
        }
        const base = Base.new();
        base.value = NaN;
        nodeAssert.strictEqual(base.value, 0);
    });

    test('rescue of error setter then rethrow throws error at caller', () => {
        class Base extends Contracted {
            private _value = NaN;

            get value(): number { return this._value; }
            @rescue(() => { throw new Error('Rescue fail'); })
            set value(_: number) { throw new Error('Setter fail'); }
        }
        const base = Base.new();
        nodeAssert.throws(() => base.value = 12, { message: 'Rescue fail' });
    });
});

describe('The rescue declarations are enabled in checkedMode and disabled otherwise', () => {
    test('enabled', () => {
        nodeAssert.throws(() => {
            class Base extends Contracted {
                @rescue(() => { throw new Error('I am still an Error'); })
                throws(value: string): void {
                    throw new Error(value);
                }
            }

            const base = Base.new();
            base.throws('I am Error');
        }, { message: 'I am still an Error' });
    });

    test('disabled', () => {
        Contracted[checkedMode] = false;

        nodeAssert.throws(() => {
            class Base extends Contracted {
                @rescue(() => { throw new Error('I am still an Error'); })
                throws(value: string): void {
                    throw new Error(value);
                }
            }

            const base = Base.new();
            base.throws('I am Error');
        }, { message: 'I am Error' });

        Contracted[checkedMode] = true;
    });
});

describe('The `retry` argument of the `rescue` declaration can only be called once during rescue execution', () => {
    test('rescue of method with an error then retrying returns ok', () => {
        class Base extends Contracted {
            @rescue((_self, _error: any, _args: any[], retry: any) => { retry(3); })
            method(value: number): number {
                if (value <= 0)
                    throw new Error('value must be greater than 0');
                else
                    return value;
            }
        }
        const base = Base.new();
        nodeAssert.strictEqual(base.method(0), 3);
    });

    test('rescue of method with an error then retrying twice throws', () => {
        class Base extends Contracted {
            @rescue((_self, _error: any, _args: any[], retry: any) => {
                retry(3);
                retry(3);
            })
            method(value: number): number {
                if (value <= 0)
                    throw new Error('value must be greater than 0');
                else
                    return value;
            }
        }
        const base = Base.new();
        try {
            base.method(0);
            nodeAssert.fail('Expected an error to be thrown');
        } catch (error: any) {
            nodeAssert.strictEqual(error.message, 'retry can only be called once');
        }
    });
});

describe('If a `rescue` is executed and the `retry` argument is not called then the original error is thrown', () => {
    class Base extends Contracted {
        @rescue((_self, _error, _args, retry: (trigger: boolean) => boolean) => { retry(false) })
        throwRescue(trigger: boolean): boolean {
            if (trigger)
                throw new Error('I am error');
            else
                return true;
        }
        @rescue(() => { /* Do nothing */ })
        throwFail(): void {
            throw new Error('I am error');
        }
    }

    const base = Base.new();

    test('Rescued error', () => {
        nodeAssert.strictEqual(base.throwRescue(true), true);
    });

    test('Un-rescued error', () => {
        nodeAssert.throws(() => base.throwFail(), { message: 'I am error' });
    });
});

describe('If an exception is thrown in a class feature without a `rescue` defined then the exception is raised to its caller after the `invariant` is checked', () => {
    class A extends Contracted {
        method(): void {
            throw new Error('I am error');
        }
    }

    test('Throwing error without `invariant` is raised to caller', () => {
        nodeAssert.throws(() => A.new().method(), { message: 'I am error' });
    });

    @invariant(self => self.value > 0)
    class B extends Contracted {
        private _value = 1;
        get value() { return this._value; }
        set value(v) { this._value = v; }

        method1(): void {
            this.value = 3;
            throw new Error('I am error');
        }

        method2(): void {
            this.value = -2;
            throw new Error('I am error');
        }
    }

    test('Throwing error with `invariant`', () => {
        nodeAssert.throws(() => B.new().method1(), { message: 'I am error' });
        nodeAssert.throws(() => { B.new().method2(); }, /^Error: Invariant violated/);
    });
});

describe('If an error is thrown in `demands` the error is raised to the caller', () => {
    @invariant(self => self.value > 0)
    class A extends Contracted {
        private _value = 1;
        get value() { return this._value; }
        set value(v) { this._value = v; }

        @demands((self, [value]) => value >= 0)
        @rescue((self, _error, [value], _retry) => { if (value === -2) throw new Error('Rescue Error'); })
        method(value: number): void {
            this.value = value;
        }

        @demands(() => false)
        @rescue(() => { throw new Error('Rescue Error'); })
        methodEmpty(): void { }

        @demands(() => true)
        @rescue(() => { throw new Error('Rescue Error'); })
        methodError(): void { throw new Error('Feature Error'); }
    }

    test('Error pathways', () => {
        nodeAssert.doesNotThrow(() => A.new().method(1));
        nodeAssert.throws(() => A.new().method(0), /^Error: Invariant violated/);
        nodeAssert.throws(() => A.new().method(-1), /^Error: No demands were satisfied/);
        nodeAssert.throws(() => A.new().method(-2), /^Error: No demands were satisfied/);
        nodeAssert.throws(() => A.new().methodEmpty(), /^Error: No demands were satisfied/);
        nodeAssert.throws(() => A.new().methodError(), /^Error: Rescue Error/);
    });
});

describe('If an error is raised in an `ensures` then the associated rescue is executed', () => {
    @invariant((self: A) => self.value >= 0)
    class A extends Contracted {
        private _value = 1;
        get value() { return this._value; }
        set value(v) { this._value = v; }

        @ensures((self: A) => self.value > 0)
        @rescue((self: A, _error, [value], _retry) => { if (value === -2) throw new Error('Rescue Error'); })
        method(value: number): void { this.value = value; }

        @ensures(() => false)
        methodEmpty(): void { }

        @ensures(() => true)
        @rescue(() => { throw new Error('Rescue Error'); })
        methodError(): void { throw new Error('Feature Error'); }
    }

    test('Error pathways', () => {
        nodeAssert.doesNotThrow(() => A.new().method(1));
        nodeAssert.throws(() => A.new().method(0), /^Error: No ensurances were satisfied for/);
        nodeAssert.throws(() => A.new().method(-1), /^Error: Invariant violated/);
        nodeAssert.throws(() => A.new().methodEmpty(), /^Error: No ensurances were satisfied for/);
        nodeAssert.throws(() => A.new().methodError(), /^Error: Rescue Error/);
    });
});