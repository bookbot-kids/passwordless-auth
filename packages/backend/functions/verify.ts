import { APIGatewayProxyHandler } from 'aws-lambda'
import { CognitoIdentityServiceProvider } from 'aws-sdk'

const cisp = new CognitoIdentityServiceProvider()

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const PASSCODE_TIMEOUT = parseInt(process.env.PASSCODE_TIMEOUT || '180000')
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

    const customAuthChallenge =  resp.UserAttributes?.find(a => a.Name === 'custom:authChallenge')?.Value
   if(!customAuthChallenge) {
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

   const [authChallenge, timestamp] = customAuthChallenge.split(',')
    if (!authChallenge || !timestamp) {
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

   // is the correct challenge and is not expired   
  if (
    challengeAnswer === authChallenge &&
    Date.now() <= Number(timestamp) + PASSCODE_TIMEOUT) {
    return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: `success`,
        }),
      }
  }

  return {
    statusCode: 401,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: `Passcode is invalid`,
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