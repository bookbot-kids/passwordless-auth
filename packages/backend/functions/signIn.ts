import { APIGatewayProxyHandler } from 'aws-lambda'
import { randomDigits } from 'crypto-secure-random-digit'
import { CognitoIdentityServiceProvider, SES } from 'aws-sdk'

const cisp = new CognitoIdentityServiceProvider()
const ses = new SES({ region: process.env.AWS_REGION })

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    const email = body['email']
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

    // set the code in custom attributes
    const authChallenge = randomDigits(6).join('')
    await cisp
      .adminUpdateUserAttributes({
        UserAttributes: [
          {
            Name: 'custom:authChallenge',
            Value: `${authChallenge},${Date.now()}`,
          },
        ],
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
      })
      .promise()

    await sendEmail(email, authChallenge)

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: `A link has been sent to ${email}`,
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

async function sendEmail(emailAddress: string, authChallenge: string) {
  const MAGIC_LINK = `${process.env.BASE_URL}?email=${emailAddress}&code=${authChallenge}`

  const body = `${process.env.EMAIL_BODY}`.trim().replace("#LINK#", MAGIC_LINK).replace("#PASSCODE#", authChallenge).replace("#EMAIL#", emailAddress)
  const text = `${process.env.EMAIL_TEXT}`.trim().replace("#LINK#", MAGIC_LINK).replace("#PASSCODE#", authChallenge)
  const subject = `${process.env.EMAIL_SUBJECT}`.trim().replace("#LINK#", MAGIC_LINK).replace("#PASSCODE#", authChallenge)

  const params: SES.SendEmailRequest = {
    Destination: { ToAddresses: [emailAddress] },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: body,
        },
        Text: {
          Charset: 'UTF-8',
          Data: text,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: process.env.SES_FROM_ADDRESS,
  }
  await ses.sendEmail(params).promise()
}
