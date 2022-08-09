import { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda'

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (
  event
) => {
  const [authChallenge, timestamp] = (
    event.request.privateChallengeParameters.challenge || ''
  ).split(',')

  // fail if any one of the parameters is missing
  if (!authChallenge || !timestamp) {
    event.response.answerCorrect = false
    return event
  }

  const PASSCODE_TIMEOUT = parseInt(process.env.PASSCODE_TIMEOUT || '180000')
  // is the correct challenge and is not expired
  if (
    event.request.challengeAnswer === authChallenge &&
    Date.now() <= Number(timestamp) + PASSCODE_TIMEOUT
  ) {
    event.response.answerCorrect = true
    return event
  }

  event.response.answerCorrect = false
  return event
}
