import { VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda'
import { CognitoIdentityServiceProvider } from 'aws-sdk'

const cisp = new CognitoIdentityServiceProvider()

export const handler: VerifyAuthChallengeResponseTriggerHandler = async (
  event
) => {
  const PASSCODE_TIMEOUT = parseInt(process.env.PASSCODE_TIMEOUT || '180000')
  const challenges = (event.request.privateChallengeParameters.challenge || '').split(';')

  console.log(`verifyAuthChallenge for ${event.userName} in ${event.userPoolId}, challenges=[${challenges}], answer=${event.request.challengeAnswer}, timeout=${PASSCODE_TIMEOUT}`)

  var isValid = false
  var matchedChallenge: string | null = null
  for (var att of challenges) {
    const [authChallenge, timestamp] = att.split(',')

    // fail if any one of the parameters is missing
    if (!authChallenge || !timestamp) {
      isValid = false
    }

    // is the correct challenge and is not expired
    if (
      event.request.challengeAnswer === authChallenge &&
      Date.now() <= Number(timestamp) + PASSCODE_TIMEOUT
    ) {
      isValid = true
      matchedChallenge = att
      break
    }

    isValid = false
  }

  console.log(`verifyAuthChallenge result for ${event.userName}: answerCorrect=${isValid}, matched=${matchedChallenge}`)

  event.response.answerCorrect = isValid

  if (isValid && matchedChallenge) {
    await removeUsedPasscode(
      event.userPoolId,
      event.userName,
      matchedChallenge,
      PASSCODE_TIMEOUT
    )
  }

  return event
}

// the passcode is single use, remove it from the list along with the expired ones
async function removeUsedPasscode(
  userPoolId: string,
  username: string,
  matchedChallenge: string,
  timeout: number
) {
  try {
    // read the current value instead of the one captured when the challenge was
    // created, so a passcode issued in the meantime doesn't get wiped
    const resp = await cisp
      .adminGetUser({ UserPoolId: userPoolId, Username: username })
      .promise()
    const current =
      resp.UserAttributes?.find(a => a.Name === 'custom:authChallenge')?.Value || ''
    const remaining = current.split(';').filter(item => {
      if (item === matchedChallenge) {
        return false
      }
      const timestamp = Number(item.split(',')[1])
      return timestamp + timeout > Date.now()
    })

    console.log(`removing used passcode for ${username}: [${current}] -> [${remaining.join(';')}]`)

    await cisp
      .adminUpdateUserAttributes({
        UserAttributes: [
          {
            Name: 'custom:authChallenge',
            Value: remaining.join(';'),
          },
        ],
        UserPoolId: userPoolId,
        Username: username,
      })
      .promise()
  } catch (e) {
    // the sign in already succeeded, don't fail it because the cleanup failed
    console.error(`failed to remove used passcode for ${username}`, e)
  }
}
