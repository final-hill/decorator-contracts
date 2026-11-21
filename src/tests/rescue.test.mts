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
            nodeAssert.strictEqual(error.message, 'retry can only be called once per rescue execution');
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
/**
 * https://github.com/final-hill/decorator-contracts/issues/281
 *
 * Per docs/order-of-assertions.png a `retry` restarts the lifecycle at
 * `@invariant`, so the retried invocation is subject to `@demands` and
 * `@ensures` like any other call.
 */
describe('A retried invocation re-enters the contract lifecycle', () => {
    test('the lifecycle runs in documented order', () => {
        const log: string[] = [];

        @invariant((_self: Foo) => { log.push('invariant'); return true; })
        class Foo extends Contracted {
            protected _n = 0;
            get n() { return this._n; }
            set n(v: number) { this._n = v; }

            @demands((self: Foo, [v]: [number]) => { log.push('demands:' + v); return v > 0; })
            @ensures((self: Foo) => { log.push('ensures:' + self.n); return true; })
            @rescue((_self, _error, _args, retry) => { log.push('rescue'); retry(5); })
            method(v: number): number {
                log.push('body:' + v);
                if (v == 1) throw new Error('forced');

                this.n = v;

                return v;
            }
        }

        const foo = Foo.new();
        log.length = 0;

        nodeAssert.strictEqual(foo.method(1), 5);
        nodeAssert.deepStrictEqual(log, [
            'invariant', 'demands:1', 'body:1', 'rescue',
            'invariant', 'demands:5', 'body:5', 'ensures:5', 'invariant'
        ]);
    });

    test('a retry that violates the demands throws', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [v]: [number]) => v > 0)
            @rescue((_self, _error, _args, retry) => retry(-99))
            method(v: number): number {
                if (v < 0) throw new Error('negative');

                return v;
            }
        }

        nodeAssert.throws(() => Foo.new().method(-1), /^Error: No demands were satisfied/);
    });

    test('a retry that violates the ensures throws', () => {
        class Foo extends Contracted {
            protected _n = 0;
            protected _attempts = 0;
            get n() { return this._n; }

            @ensures((self: Foo) => self.n == 0)
            @rescue((self: Foo, _error, _args, retry) => { self.n = 3; retry(); }, { maxRetries: 1 })
            method(): void {
                if (this._attempts++ == 0) throw new Error('forced');
            }
            set n(v: number) { this._n = v; }
        }

        nodeAssert.throws(() => Foo.new().method(), /^Error: No ensurances were satisfied/);
    });

    test('a retry that violates the invariant throws', () => {
        @invariant((self: Foo) => self.n == 0)
        class Foo extends Contracted {
            protected _n = 0;
            protected _attempts = 0;
            get n() { return this._n; }

            @rescue((self: Foo, _error, _args, retry) => { self.n = 3; retry(); }, { maxRetries: 1 })
            method(): void {
                if (this._attempts++ == 0) throw new Error('forced');
            }
            set n(v: number) { this._n = v; }
        }

        nodeAssert.throws(() => Foo.new().method(), /^Error: Invariant violated/);
    });
});

describe('A retried getter and setter re-enter the contract lifecycle', () => {
    test('getter', () => {
        const log: string[] = [];

        class Foo extends Contracted {
            protected _v = 0;

            @demands(() => { log.push('demands'); return true; })
            @rescue((self: Foo, _error, _args, retry) => { log.push('rescue'); self.warm(); retry(); })
            get v(): number {
                log.push('body');
                if (this._v == 0) throw new Error('cold');

                return this._v;
            }

            warm(): void { this._v = 7; }
        }

        const foo = Foo.new();
        log.length = 0;

        nodeAssert.strictEqual(foo.v, 7);
        nodeAssert.deepStrictEqual(log, ['demands', 'body', 'rescue', 'demands', 'body']);
    });

    test('setter', () => {
        const log: string[] = [];

        class Foo extends Contracted {
            protected _v = NaN;
            get v() { return this._v; }

            @demands((self: Foo, [v]: [number]) => { log.push('demands:' + v); return true; })
            @rescue((_self, _error, _args, retry) => { log.push('rescue'); retry(0); })
            set v(value: number) {
                log.push('body:' + value);
                if (Number.isNaN(value)) throw new Error('NaN');

                this._v = value;
            }
        }

        const foo = Foo.new();
        log.length = 0;

        foo.v = NaN;

        // compare the log before reading `foo.v`, which itself runs the lifecycle
        nodeAssert.deepStrictEqual(log, ['demands:NaN', 'body:NaN', 'rescue', 'demands:0', 'body:0']);
        log.length = 0;
        nodeAssert.strictEqual(foo.v, 0);
    });
});

describe('A retried invocation re-enters its `@rescue` so it can select another strategy', () => {
    test('an always-throwing retry terminates when `maxRetries` is set', () => {
        let bodyCalls = 0;

        class Foo extends Contracted {
            @rescue((_self, _error, _args, retry) => retry(), { maxRetries: 1 })
            method(): number {
                bodyCalls++;
                throw new Error('always');
            }
        }

        nodeAssert.throws(() => Foo.new().method(), { message: 'always' });
        nodeAssert.strictEqual(bodyCalls, 2);
    });

    test('a rescue handler is executed once per attempt', () => {
        const attempts: number[] = [];

        class Foo extends Contracted {
            protected _attempt = 0;

            @rescue((self: Foo, _error, _args, retry) => {
                attempts.push(self._attempt++);
                retry();
            }, { maxRetries: 2 })
            method(): number {
                throw new Error('always');
            }
        }

        nodeAssert.throws(() => Foo.new().method(), { message: 'always' });
        nodeAssert.deepStrictEqual(attempts, [0, 1]);
    });

    test('a handler can supply an alternative result instead of retrying', () => {
        class Foo extends Contracted {
            @rescue(() => { throw new Error('version B failed'); })
            method(): string { throw new Error('version A failed'); }
        }

        nodeAssert.throws(() => Foo.new().method(), { message: 'version B failed' });
    });
});

describe('N-Version programming with `@rescue`', () => {
    test('falls back through successive versions until one succeeds', () => {
        class Foo extends Contracted {
            protected _version = 0;
            protected _tried: string[] = [];

            @rescue((self: Foo, _error, args, retry) => {
                self._version++;
                retry(...args);
            })
            request(x: number): string {
                const versions = ['legacy', 'activex', 'xhr'];
                const version = versions[this._version];

                this._tried.push(version);

                if (version !== 'xhr') throw new Error(version + ' unsupported');

                return 'xhr:' + x;
            }
        }

        const foo = Foo.new();

        nodeAssert.strictEqual(foo.request(1), 'xhr:1');
        nodeAssert.deepStrictEqual((foo as any)._tried, ['legacy', 'activex', 'xhr']);
    });

    test('surfaces the last error when every version fails', () => {
        class Foo extends Contracted {
            protected _version = 0;

            @rescue((self: Foo, _error, _args, retry) => {
                self._version++;
                retry();
            }, { maxRetries: 2 })
            request(): string {
                throw new Error('version ' + this._version + ' failed');
            }
        }

        nodeAssert.throws(() => Foo.new().request(), { message: 'version 2 failed' });
    });

    /**
     * Mirrors the ajax example in the README so the documentation stays accurate.
     */
    test('README ajax example', () => {
        class AjaxRequest extends Contracted {
            protected _version = 0;
            protected _versions = ['legacy', 'activex', 'xhr'] as const;
            protected _tried: string[] = [];

            @rescue((self: AjaxRequest, _error, args, retry) => {
                self._version++;
                retry(...args);
            }, { maxRetries: 2 })
            get(url: string): string {
                const version = this._versions[this._version];

                this._tried.push(version);

                if (version !== 'xhr') throw new Error(`${version} unsupported`);

                return 'xhr:' + url;
            }
        }

        const request = AjaxRequest.new();

        nodeAssert.strictEqual(request.get('/students'), 'xhr:/students');
        nodeAssert.deepStrictEqual((request as any)._tried, ['legacy', 'activex', 'xhr']);
    });

    test('each attempt is subject to the contracts', () => {
        const demandChecks: number[] = [];

        class Foo extends Contracted {
            protected _version = 0;

            @demands((_self: Foo, [x]: [number]) => {
                demandChecks.push(x);
                return x > 0;
            })
            @rescue((self: Foo, _error, _args, retry) => {
                self._version++;
                retry(5);
            })
            request(x: number): number {
                if (this._version == 0) throw new Error('unsupported');

                return x;
            }
        }

        const foo = Foo.new();

        nodeAssert.strictEqual(foo.request(5), 5);
        // the retry re-enters `@invariant` -> `@demands`, so the demand is checked again
        nodeAssert.deepStrictEqual(demandChecks, [5, 5]);
    });

    test('a retried invocation that violates a demand throws', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [x]: [number]) => x > 0)
            @rescue((_self, _error, _args, retry) => retry(-1))
            request(x: number): number {
                if (x > 0) throw new Error('unsupported');

                return x;
            }
        }

        nodeAssert.throws(() => Foo.new().request(1), /^Error: No demands were satisfied/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/285
 */
describe('A `retry` works when the feature is inherited', () => {
    test('inherited method', () => {
        class Base extends Contracted {
            protected _attempts = 0;

            @rescue((_self, _error, _args, retry) => retry(0))
            method(v: number): number {
                if (this._attempts++ == 0) throw new Error('bad');

                return v;
            }
        }

        class Sub extends Base { }

        nodeAssert.strictEqual(Sub.new().method(0), 0);
    });

    test('inherited getter', () => {
        class Base extends Contracted {
            protected _v = 0;
            @rescue((self: Base, _error, _args, retry) => { self.warm(); retry(); })
            get v(): number {
                if (this._v == 0) throw new Error('cold');

                return this._v;
            }
            warm(): void { this._v = 7; }
        }

        class Sub extends Base { }

        nodeAssert.strictEqual(Sub.new().v, 7);
    });
});
