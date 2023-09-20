import { APIGatewayProxyHandler } from 'aws-lambda'
import { CognitoIdentityServiceProvider } from 'aws-sdk'

const cisp = new CognitoIdentityServiceProvider()

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const PASSCODE_TIMEOUT = Number(process.env.PASSCODE_TIMEOUT || '1800000')
    const body = JSON.parse(event.body || '{}')
    var email = body['email']
    const challengeAnswer = body['passcode']
    const authCode = body['code']
    if (!authCode || process.env.AUTHENTICATION_CODE !== authCode) {
        return {
            statusCode: 401,
            body: JSON.stringify({
            message: 'Authentication code is invalid'
            })
        }
    }

    if(!email) {
        return {
            statusCode: 400,
            body: JSON.stringify({
            message: 'Missing email'
            })
        }
    }

    if(!challengeAnswer) {
        return {
            statusCode: 400,
            body: JSON.stringify({
            message: 'Missing passcode'
            })
        }
    }

    email = email.toLowerCase()

    // get the code in custom attributes
    const resp = await cisp.adminGetUser({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
    }).promise()

    const customAuthChallenge =  resp.UserAttributes?.find(a => a.Name === 'custom:authChallenge')?.Value || ''
    const list = customAuthChallenge.split(';')
    if(list.length == 0) {
      return {
        statusCode: 401,
        headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            message: `No authentication found for ${email}`,
          }),
      }
    }

    var errorMessage: string | null = null
    for (var att of list) {
      errorMessage = validate(challengeAnswer, att, PASSCODE_TIMEOUT)
        if(!errorMessage) {
          // if any valid
          break
        }
    }

    if(errorMessage) {
      console.log(`validate failed  ${errorMessage}`);
      // invalid
      return {
        statusCode: 401,
        headers: {
        'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
        message: `${errorMessage} for ${email}`,
        }),
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: `success`,
      }),
    }
    
  } catch (e) {
    console.error(e)
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: `Couldn't process the request. Please try after some time.`,
      }),
    }
  }
}

function validate(challengeAnswer: string, attribute: string, timeout: number): string | null {
  const [authChallenge, timestamp] = attribute.split(',')
    if (!authChallenge || !timestamp) {
        return 'No authentication found'
    }

   // is the correct challenge and is not expired  
   if(challengeAnswer === authChallenge) {
      if(Date.now() <= Number(timestamp) + timeout) {
        return null
      } else {
        return 'Passcode is expired'
      }
   } else {
    return 'Passcode is invalid'
   }
}