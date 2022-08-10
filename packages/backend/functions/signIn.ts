import { APIGatewayProxyHandler } from 'aws-lambda'
import { randomDigits } from 'crypto-secure-random-digit'
import { CognitoIdentityServiceProvider, SES } from 'aws-sdk'

const cisp = new CognitoIdentityServiceProvider()
const ses = new SES({ region: process.env.AWS_REGION })

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    var email = body['email']
    const authCode = body['code']
    const language = body['language'] || 'en'
    
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

    email = email.toLowerCase()

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
    
      // send email
    await sendEmail(email, authChallenge, language)

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: `Passcode and url has been sent to ${email}`,
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

async function sendEmail(emailAddress: string, authChallenge: string, language: string = 'en') {
  const MAGIC_LINK = `${process.env.BASE_URL}?email=${emailAddress}&code=${authChallenge}`
  const bodyTexts = new Map<string, string>(
    [
      ['en',`
<html><body>
<p>Hi there,<br/><br/>
To verify ${emailAddress}, you can either enter the passcode:<br/><br/>
<span style="font-size:28pt">${authChallenge}</span><br/><br/>
Or use this <a target="_blank" rel="noopener noreferrer" href="${MAGIC_LINK}">link</a> to verify Bookbot on this device.</p>   
</body></html>
`.trim()],
    ['id', `
<html><body>
<p>Hai,<br/><br/>
Untuk memverifikasi ${emailAddress}, Anda bisa memasukkan kode:<br/><br/>
<span style="font-size:28pt">${authChallenge}</span><br/><br/>
Atau gunakan <a target="_blank" rel="noopener noreferrer" href="${MAGIC_LINK}">tautan</a> ini untuk memverifikasi Bookbot pada perangkat ini.</p>   
</body></html>
`.trim()]
    ]
  );

  const subjectTexts = new Map<string, string>(
    [
      ['en', 'Verify your email address'],
      ['id', 'Verifikasi alamat email Anda'],
    ]);

  const addresses = new Map<string, string>([
    ['en', `Team Bookbot <${process.env.SES_FROM_ADDRESS}>`],
    ['id', `Tim Bookbot <${process.env.SES_FROM_ADDRESS}>`],
  ])

  const body = bodyTexts.get(language) || bodyTexts.get('en')!
  const subject = subjectTexts.get(language) || subjectTexts.get('en')!
  const sourceAddess = addresses.get(language) || addresses.get('en')!

  const params: SES.SendEmailRequest = {
    Destination: { ToAddresses: [emailAddress] },
    Message: {
      Body: {
        Html: {
          Charset: 'UTF-8',
          Data: body ,
        },
        Text: {
          Charset: 'UTF-8',
          Data: subject,
        },
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject,
      },
    },
    Source: sourceAddess,
  }
  await ses.sendEmail(params).promise()
}
