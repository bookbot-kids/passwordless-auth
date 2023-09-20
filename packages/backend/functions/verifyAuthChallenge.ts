import { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda'

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (
  event
) => {  
  const challenges = (event.request.privateChallengeParameters.challenge || '').split(';')

  var isValid = false
  for (var att of challenges) {
    const [authChallenge, timestamp] = att.split(',')

    // fail if any one of the parameters is missing
    if (!authChallenge || !timestamp) {
      isValid = false
    }

    const PASSCODE_TIMEOUT = parseInt(process.env.PASSCODE_TIMEOUT || '180000')
    // is the correct challenge and is not expired
    if (
      event.request.challengeAnswer === authChallenge &&
      Date.now() <= Number(timestamp) + PASSCODE_TIMEOUT
    ) {
      isValid = true
      break
    }

    isValid = false
  }

  event.response.answerCorrect = isValid
  return event
}
