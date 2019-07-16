import assertion from './assertion'
import requires from './requires'

export default function(debugMode: boolean) {
    return {
        assert: assertion(debugMode),
        requires: requires(debugMode)
    }
}