import assertion from './assertion';
import ensures from './ensures';
import requires from './requires';

export default function(debugMode: boolean) {
    return {
        assert: assertion(debugMode),
        ensures: ensures(debugMode),
        requires: requires(debugMode)
    };
}