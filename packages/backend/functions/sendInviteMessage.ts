import { APIGatewayProxyHandler } from 'aws-lambda'
import { SES } from 'aws-sdk'
import fetch from 'node-fetch';

const ses = new SES({ region: process.env.AWS_REGION })

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}')
    var email = body['email']
    const authCode = body['code']
    const language = body['language'] || 'en'
    const phone = body['phone'] || ''
    const senderType = body['sender_type'] || 'email'
    const name = body['name'] || ''
    const deepLink = body['link'] || ''
    
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

    if(!name) {
      return {
          statusCode: 400,
          body: JSON.stringify({
          message: 'Missing name'
          })
      }
    }

    if(!deepLink) {
      return {
          statusCode: 400,
          body: JSON.stringify({
          message: 'Missing link'
          })
      }
    }

    const deepLinkParts = deepLink.split ("/");
    const linkParam = deepLinkParts[deepLinkParts.length - 1];

    email = email.toLowerCase()
   
    // send whatsapp message
    if(senderType == 'whatsapp') {
      console.log(`send whatsapp message to  ${phone}`);
      await sendWhatsapp(process.env.WHATSAPP_APP_ID, process.env.WHATSAPP_APP_KEY, process.env.WHATSAPP_INVITE_TEMPLATE_NAME, phone, name, linkParam, language)
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
   
      // send email
    await sendEmail(name, deepLink, email, language)

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

async function sendWhatsapp(appId: string, token: string, templateName: string, phone: string, name: string, link: string, language: string = 'en') {
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
          "type": "header",
          "parameters": [
            {
              "type": "text",
              "text": name
            }
          ]
        },
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "text": name
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
              "text": link
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

async function sendEmail(name: string, magicLink: string, emailAddress: string, language: string = 'en') { 
  const bodyTexts = new Map<string, string>(
    [
      ['en',`
<html><body>
<p>Hi there,<br/><br/>

You’ve been invited by ${name}'s teacher to download Bookbot. By downloading Bookbot, ${name} will:<br/><br/>

Get access to a library of special books designed to develop reading skills<br/><br/>

Share awards between their classroom and home profile<br/><br/>

Allow ${name}'s teacher to see their reading homework<br/><br/>

Bookbot is private and only your teacher can see what books you’ve read.<br/><br/>
<a target="_blank" rel="noopener noreferrer" href="${magicLink}">Connect to Bookbot</a> 
</body></html>
`.trim()],
    ['id', `
<html><body>
<p>Hai,<br/><br/>

Anda telah diundang oleh guru ${name} untuk mengunduh Bookbot. Dengan mengunduh Bookbot, ${name} akan:<br/><br/>

Mendapatkan akses ke perpustakaan buku khusus yang dirancang untuk mengembangkan keterampilan membaca<br/><br/>

Berbagi penghargaan antar kelas dan profil pribadi<br/><br/>

Mengizinkan guru Anda melihat pekerjaan rumah membaca ${name} <br/><br/>

Bookbot bersifat pribadi dan hanya guru Anda yang dapat melihat buku apa yang telah Anda baca.<br/><br/>

<a target="_blank" rel="noopener noreferrer" href="${magicLink}">Sambung ke bookbot</a> 
</body></html>
`.trim()],
['sw', `
<html><body> 
<p>Hujambo,<br/><br/>

Umealikwa na mwalimu wa ${name} kudownload Bookbot. Kwa kudownload Bookbot,namekudownloadBookbot.KwakudownloadBookbot, ${name} ataweza:<br/><br/>

Kupata maktaba ya vitabu maalum vilivyoundwa kukuza ujuzi wa kusoma<br/><br/>

Kushiriki tuzo kati ya profaili yao ya darasani na nyumbani<br/><br/>

Kumruhusu mwalimu wa ${name} kuona kazi yao ya nyumbani ya kusoma <br/><br/>

Bookbot ni ya kibinafsi na ni mwalimu wako pekee anayeweza kuona vitabu ulivyosoma.<br/><br/>
<a target="_blank" rel="noopener noreferrer" href="${magicLink}">Unganisha na Bookbot</a>

</body></html>
  `.trim()]
    ]
  );

  const subjectTexts = new Map<string, string>(
    [
      ['en', `${name}'s teacher has invited you to Bookbot`],
      ['id', `Guru ${name} telah mengundang Anda ke Bookbot`],
      ['sw', `Mwalimu wa ${name} amekualika kwenye Bookbot `],
    ]);

  const addresses = new Map<string, string>([
    ['en', `Team Bookbot <${process.env.SES_FROM_ADDRESS}>`],
    ['id', `Tim Bookbot <${process.env.SES_FROM_ADDRESS}>`],
    ['sw', `Timu ya Bookbot <${process.env.SES_FROM_ADDRESS}>`],
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
