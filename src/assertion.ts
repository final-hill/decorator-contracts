import AssertionError from './AssertionError';

/**
 * Tests the provided condition. If the condition is false an AssertionError is raised with an optional message.
 * If the provided condition is true, then the function returns without raising an error
 *
 * @param condition - The condition to test
 * @param message - A descriptive message to associate with the AssertionError
 * @throws - Throws an AssertionError when the condition is false
 * @see AssertionError
 *
 * @example
 * let x = 15;
 * assert(x > 5, `Expected: x > 5. Actual: x = ${x}`)
 */
function debugAssert(condition: boolean, message: string = 'Assertion failure'): void {
    if(!condition) {
        throw new AssertionError(message);
    }
}

// @ts-ignore : ignoring unused variable warning
function prodAssert(condition: boolean, message: string = 'Assertion failure'): void {}

/**
 * Returns a reference to the appropriate assertion implementation based on debugMode.
 * Assertions are enabled when debugMode is true, and disabled otherwise
 *
 * @param debugMode - The flag representing mode of the library
 */
export default function(debugMode: boolean) {
    return debugMode ? debugAssert : prodAssert;
}