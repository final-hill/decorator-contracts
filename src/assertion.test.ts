import assertion from './assertion'
import AssertionError from './AssertionError';

describe('debug assertions should execute', () => {
    let assert = assertion(true)

    const X = 15

    it(`assert(X > 5) === undefined`, () => {
        expect(assert(X > 5)).toBe(undefined)
    })

    it(`assert(X > 200) throws AssertionError`, () => {
        expect(() => assert(X > 200)).toThrow(AssertionError)
    })

    it(`assert(X > 200, 'Assertion Failed') throws AssertionError('Assertion Failed')`, () => {
        expect(() => assert(X > 200, 'Assertion Failed')).toThrow('Assertion Failed')
    })
})

describe('prod assertions should be NOOPs', () => {
    let assert = assertion(false)

    const X = 15

    it(`assert(X > 5) === undefined`, () => {
        expect(assert(X < 5)).toBe(undefined)
    })

    it(`assert(X > 200) === undefined`, () => {
        expect(assert(X > 200)).toBe(undefined)
    })

    it(`assert(X > 200, 'Assertion Failed') === undefined`, () => {
        expect(assert(X > 200)).toBe(undefined)
    })
})