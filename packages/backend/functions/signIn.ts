import { APIGatewayProxyHandler } from 'aws-lambda'
import { randomDigits } from 'crypto-secure-random-digit'
import { CognitoIdentityServiceProvider, SES } from 'aws-sdk'
import fetch from 'node-fetch';

const cisp = new CognitoIdentityServiceProvider()
const ses = new SES({ region: process.env.AWS_REGION })

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const PASSCODE_TIMEOUT = Number(process.env.PASSCODE_TIMEOUT || '1800000')
    const body = JSON.parse(event.body || '{}')
    var email = body['email']
    const authCode = body['code']
    const language = body['language'] || 'en'
    const disableEmail = body['disableEmail'] || 'false'
    const appId = body['app_id'] || ''
    const phone = body['phone'] || ''
    const senderType = body['sender_type'] || 'email'
    
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

    // get current attribute
    // get user id from preferred_username
    const userResponse = await cisp.adminGetUser({
      UserPoolId: process.env.USER_POOL_ID,
      Username: email,
    }).promise()  
    
    const userId = userResponse.UserAttributes?.find(x => x.Name == 'preferred_username')?.Value || '';

    // get challenges
    const currentChallengesAttribute =  userResponse.UserAttributes?.find(a => a.Name === 'custom:authChallenge')?.Value || ''

    // remove expired ones
    const challenges = currentChallengesAttribute.split(';').filter(item => {
      const timestamp = Number(item.split(",")[1]);
      return timestamp  + PASSCODE_TIMEOUT > Date.now();
    });

    // add new code into list
    const authChallenge = randomDigits(6).join('')
    const newChallenge = `${authChallenge},${Date.now()}`
    challenges.push(newChallenge)
    // set to attribute
    await cisp
      .adminUpdateUserAttributes({
        UserAttributes: [
          {
            Name: 'custom:authChallenge',
            Value: challenges.join(';'),
          },
        ],
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
      })
      .promise()

    // send whatsapp message
    if(senderType == 'whatsapp') {
      console.log(`send whatsapp message to  ${phone}`);
      await sendWhatsapp(process.env.WHATSAPP_APP_ID, process.env.WHATSAPP_APP_KEY, process.env.WHATSAPP_TEMPLATE_NAME, phone, authChallenge, language)
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: `Passcode and has been sent to ${phone}`,
        }),
      }
    }
       
    // return passcode and don't send email
    if(disableEmail == 'true') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: `success`,
          passcode: authChallenge,
        }),
      }
    }
    
    // generate magic link from firebase dynamic link
    const isReportApp = appId == process.env.ANDROID_REPORT_PACKAGE_NAME || appId == process.env.IOS_REPORT_APP_BUNDLE
    const isIdApp = appId == process.env.IOS_ID_APP_BUNDLE || appId == process.env.ANDROID_ID_PACKAGE_NAME
    const subUrl = isIdApp ? process.env.APP_ID_SUB_DOMAIN : process.env.APP_SUB_DOMAIN
    const iOSBundleId = isReportApp ? process.env.IOS_REPORT_APP_BUNDLE : (isIdApp ? process.env.IOS_ID_APP_BUNDLE : process.env.IOS_APP_BUNDLE)
    const iOSAppStoreId = isReportApp? process.env.IOS_REPORT_APP_ID :  (isIdApp ? process.env.IOS_ID_APP_ID: process.env.IOS_APP_ID)
    const androidPackageName = isReportApp ? process.env.ANDROID_REPORT_PACKAGE_NAME :  (isIdApp ? process.env.ANDROID_ID_PACKAGE_NAME: process.env.ANDROID_PACKAGE_NAME)
    const firebaseKey = isReportApp ? process.env.REPORT_FIREBASE_DYNAMIC_LINK_KEY :  process.env.FIREBASE_DYNAMIC_LINK_KEY
    const domainUriPrefix = isReportApp ?  process.env.REPORT_FIREBASE_DYNAMIC_LINK_URL : process.env.FIREBASE_DYNAMIC_LINK_URL
    const link = isReportApp ? process.env.REPORT_URL :  `${process.env.FIREBASE_DYNAMIC_LINK_URL}/${subUrl}`
    const appName = isReportApp ? process.env.REPORT_APP_NAME : process.env.APP_NAME

    const deepLinkResponse = await fetch(`https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${firebaseKey}`, {
    method: 'POST',
    body: JSON.stringify({
      "dynamicLinkInfo": {
        "domainUriPrefix": domainUriPrefix,
        "link": `${link}?email=${email}&passcode=${authChallenge}&id=${userId}`,
        "androidInfo": {"androidPackageName": androidPackageName},
        "iosInfo": {
          "iosBundleId": iOSBundleId,
          "iosAppStoreId": iOSAppStoreId
        },
        "socialMetaTagInfo": {"socialTitle": appName}
      }
      }),
    });
  
    const jsonText = await deepLinkResponse.text();
   
    var jsonData = JSON.parse(jsonText);    
    const magicLink = jsonData['shortLink']
    console.log(`deeplink ${magicLink}`);

      // send email
    await sendEmail(magicLink, email, authChallenge, language)

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
    console.error(`Sign in error ${email}, ${e}`)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: `Couldn't process the request. Error ${e}`,
      }),
    }
  }
}

async function sendWhatsapp(appId: string, token: string, templateName: string, phone: string, authChallenge: string, language: string = 'en') {
  const response = await fetch(`https://graph.facebook.com/v17.0/${appId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": phone,
      "type": "template",
      "template": {
        "name": templateName, 
        "language": {
          "code": language
        },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": authChallenge
            }
          ]
        },
        {
          "type": "button",
          "sub_type": "url",
          "index": "0",
          "parameters": [
            {
              "type": "text",
              "text": authChallenge
            }
          ]
        }
      ]
    }
    }),
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + token
    }
   });
  
   return response.ok
}

async function sendEmail(magicLink: string, emailAddress: string, authChallenge: string, language: string = 'en') { 
  const bodyTexts = new Map<string, string>(
    [
      ['en',`
<html><body>
<p>Hi there,<br/><br/>
To verify ${emailAddress}, you can either enter the passcode:<br/><br/>
<span style="font-size:28pt">${authChallenge}</span><br/><br/>
Or use this <a target="_blank" rel="noopener noreferrer" href="${magicLink}">link</a> to verify Bookbot on this device.</p>   
</body></html>
`.trim()],
    ['id', `
<html><body>
<p>Hai,<br/><br/>
Untuk memverifikasi ${emailAddress}, Anda bisa memasukkan kode:<br/><br/>
<span style="font-size:28pt">${authChallenge}</span><br/><br/>
Atau gunakan <a target="_blank" rel="noopener noreferrer" href="${magicLink}">tautan</a> ini untuk memverifikasi Bookbot pada perangkat ini.</p>   
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
