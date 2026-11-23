import { Contracted, demands, ensures, getFeatureContracts, invariant } from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

/**
 * https://github.com/final-hill/decorator-contracts/issues/342
 *
 * `@demands` is OR-composed, so an arm added on a subclass cannot narrow the
 * precondition: satisfying any inherited arm still permits the call. The
 * declaration reads as a restriction, so it is diagnosed where it is written.
 *
 * The declarations below run at module load, which is when the diagnostic fires;
 * each suite captures `console.warn` around the class definition it is testing.
 */

/** Collects what `console.warn` receives while `define` runs. */
const captureWarnings = (define: () => void): string[] => {
    const seen: string[] = [],
        real = console.warn;

    console.warn = (...parts: unknown[]) => { seen.push(parts.join(' ')); };

    try {
        define();
    } finally {
        console.warn = real;
    }

    return seen;
};

describe('A subclass `@demands` arm that cannot narrow is reported', () => {
    test('declaring an arm below an inherited one warns, naming the class and feature', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true)
                override m(): void { }
            }

            void Sub;
        });

        nodeAssert.strictEqual(warnings.length, 1);
        nodeAssert.match(warnings[0], /@demands on m adds an arm to a precondition/);
        nodeAssert.match(warnings[0], /cannot narrow what the base permits/);
    });

    test('the message says how to proceed', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        const [warning] = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true)
                override m(): void { }
            }

            void Sub;
        });

        nodeAssert.match(warning, /Move the restriction to the base feature/);
        nodeAssert.match(warning, /`allowWeakening`/);
    });

    test('it counts the inherited arms, because any one of them permits the call', () => {
        class Base extends Contracted {
            @demands(() => true)
            @demands(() => true)
            m(): void { }
        }

        const [warning] = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true)
                override m(): void { }
            }

            void Sub;
        });

        nodeAssert.match(warning, /already has 2 inherited arm\(s\)/);
    });

    test('it fires on a grandchild too, counting the whole inherited list', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        class Middle extends Base {
            @demands(() => true)
            override m(): void { }
        }

        const [warning] = captureWarnings(() => {
            class Leaf extends Middle {
                @demands(() => true)
                override m(): void { }
            }

            void Leaf;
        });

        nodeAssert.match(warning, /already has 2 inherited arm\(s\)/);
    });

    test('it is reported once per feature, however many arms the class declares', () => {
        /*
         * The diagnostic is a property of the feature, not of the arm. Each
         * decorator runs independently, so an unconditional report would print the
         * same message once per arm — training the reader to ignore it.
         */
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true)
                @demands(() => true)
                @demands(() => true)
                override m(): void { }
            }

            void Sub;
        });

        nodeAssert.strictEqual(warnings.length, 1);
    });

    test('each feature of one class is reported separately', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }

            @demands(() => true)
            n(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true)
                override m(): void { }

                @demands(() => true)
                override n(): void { }
            }

            void Sub;
        });

        nodeAssert.strictEqual(warnings.length, 2);
        nodeAssert.match(warnings[0], /on m /);
        nodeAssert.match(warnings[1], /on n /);
    });
});

describe('A genuine weakening is not reported', () => {
    test('an arm on a feature with no inherited arm warns nothing', () => {
        const warnings = captureWarnings(() => {
            class Foo extends Contracted {
                @demands(() => true)
                m(): void { }
            }

            void Foo;
        });

        nodeAssert.deepStrictEqual(warnings, []);
    });

    test('a subclass that inherits the feature without redeclaring it warns nothing', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base { }

            void Sub;
        });

        nodeAssert.deepStrictEqual(warnings, []);
    });

    test('a subclass arm on a different feature warns nothing', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true)
                n(): void { }
            }

            void Sub;
        });

        nodeAssert.deepStrictEqual(warnings, []);
    });

    test('`allowWeakening` suppresses it', () => {
        class Base extends Contracted {
            @demands(() => true)
            m(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base {
                @demands(() => true, { allowWeakening: true })
                override m(): void { }
            }

            void Sub;
        });

        nodeAssert.deepStrictEqual(warnings, []);
    });
});

describe('`allowWeakening` is refused where no diagnostic exists', () => {
    /*
     * The option suppresses a diagnostic about OR-composition, which only a
     * precondition has. On an AND-composed contract it would be a declaration that
     * says something the runtime has no use for, discoverable only by reading the
     * source — the same defect `normalize` and `onViolation` are refused for.
     */
    test('`@ensures` refuses it, naming the reason', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @ensures(() => true, { allowWeakening: true })
                m(): void { }
            }

            void Foo;
        }, /@ensures cannot declare allowWeakening: only a precondition can be weakened/);
    });

    test('`@invariant` refuses it', () => {
        nodeAssert.throws(() => {
            @invariant(() => true, { allowWeakening: true })
            class Foo extends Contracted { }

            void Foo;
        }, /@invariant cannot declare allowWeakening/);
    });

    test('the message explains that an AND-composed arm takes effect', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @ensures(() => true, { allowWeakening: true })
                m(): void { }
            }

            void Foo;
        }, /strengthens the obligation/);
    });

    test('`@demands` still accepts it', () => {
        nodeAssert.doesNotThrow(() => {
            class Foo extends Contracted {
                @demands(() => true, { allowWeakening: true })
                m(): void { }
            }

            void Foo;
        });
    });

    test('`allowWeakening: false` is still accepted, because it asks for nothing', () => {
        // The option is refused for what it would do rather than for appearing, so
        // an explicit `false` is a no-op rather than a mistake.
        nodeAssert.doesNotThrow(() => {
            class Foo extends Contracted {
                @ensures(() => true, { allowWeakening: false })
                m(): void { }
            }

            void Foo;
        });
    });
});

describe('The asymmetry with `@ensures` is real, not a documentation claim', () => {
    test('a subclass `@ensures` arm does strengthen, so it is not reported', () => {
        class Base extends Contracted {
            @ensures(() => true)
            m(): void { }
        }

        const warnings = captureWarnings(() => {
            class Sub extends Base {
                @ensures(() => true)
                override m(): void { }
            }

            void Sub;
        });

        nodeAssert.deepStrictEqual(warnings, []);
    });

    test('a narrowing-looking subclass `@ensures` actually restricts the result', () => {
        /*
         * The counterpart of the finding: AND-composition means the subclass arm
         * *does* take effect, which is why only `@demands` is diagnosed. This is
         * asserted by behaviour, not by reading the composition rule.
         */
        class Base extends Contracted {
            @ensures(({ result }: { result: number }) => result >= 0)
            m(): number { return 5; }
        }

        class Sub extends Base {
            @ensures(({ result }: { result: number }) => result <= 3)
            override m(): number { return 5; }
        }

        // The subclass arm holds nowhere, so the AND-composed contract rejects the
        // result the base arm alone would have accepted.
        nodeAssert.doesNotThrow(() => (Base.new() as any).m());
        nodeAssert.throws(() => (Sub.new() as any).m(), /@ensures failed/);
    });

    test('a narrowing-looking subclass `@demands` has no effect on its own', () => {
        /*
         * The defect this PBI is about, asserted as behaviour: the subclass arm
         * rejects `x === 1`, and the inherited arm permits it, so the call is
         * permitted. The declaration did not narrow anything.
         */
        class Base extends Contracted {
            @demands(({ args: [x] }: { args: [number] }) => x >= 0)
            m(x: number): number { return x; }
        }

        class Sub extends Base {
            @demands(({ args: [x] }: { args: [number] }) => x >= 5)
            override m(x: number): number { return x; }
        }

        nodeAssert.strictEqual((Sub.new() as any).m(1), 1, 'the inherited arm still permits the call');
    });
});

describe('The effective arms are inspectable, so a test can assert them', () => {
    test('both arms are reported for the subclass, inherited first', () => {
        const baseArm = ({ args: [x] }: { args: [number] }) => x >= 0,
            subArm = ({ args: [x] }: { args: [number] }) => x >= 5;

        class Base extends Contracted {
            @demands(baseArm)
            m(x: number): number { return x; }
        }

        class Sub extends Base {
            @demands(subArm)
            override m(x: number): number { return x; }
        }

        nodeAssert.deepStrictEqual(
            getFeatureContracts(Sub, 'm').demands.map(entry => entry.arm),
            [baseArm, subArm],
            'the arm that decides whether the call proceeds is the inherited one',
        );
    });
});
