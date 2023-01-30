import * as cdk from '@aws-cdk/core'
import * as cg from '@aws-cdk/aws-cognito'
import * as iam from '@aws-cdk/aws-iam'
import * as apiGw from '@aws-cdk/aws-apigateway'
import { lambda } from './helpers'

export class PasswordlessAuthStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)
    const defaultFunctionTimeout = cdk.Duration.minutes(3)
    const postAuthentication = lambda(this, 'postAuthentication', {timeout: defaultFunctionTimeout})

    // User Pool and client
    const userPool = new cg.UserPool(this, 'usersPool', {
      standardAttributes: { email: { required: true, mutable: true } },
      customAttributes: {
        authChallenge: new cg.StringAttribute({ mutable: true }),
        userId: new cg.StringAttribute({ mutable: true }),
        country: new cg.StringAttribute({ mutable: true }),
        ipAddress: new cg.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false,
      },
      accountRecovery: cg.AccountRecovery.NONE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      lambdaTriggers: {
        preSignUp: lambda(this, 'preSignup', { timeout: defaultFunctionTimeout }),
        createAuthChallenge: lambda(this, 'createAuthChallenge', { timeout: defaultFunctionTimeout }),
        defineAuthChallenge: lambda(this, 'defineAuthChallenge', { timeout: defaultFunctionTimeout }),
        verifyAuthChallengeResponse: lambda(this, 'verifyAuthChallenge', { timeout: defaultFunctionTimeout})
        .addEnvironment('PASSCODE_TIMEOUT', process.env.PASSCODE_TIMEOUT),
        postAuthentication,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    postAuthentication.role?.attachInlinePolicy(
      new iam.Policy(this, 'allowConfirmingUser', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cognito-idp:AdminUpdateUserAttributes',
              'cognito-idp:AdminListGroupsForUser', 
              'cognito-idp:AdminAddUserToGroup'
            ],
            resources: [userPool.userPoolArn],
          }),
        ],
      })
    )

    const webClient = userPool.addClient('webAppClient', {
      authFlows: { custom: true },
    })

    // api gate way
    const api = new apiGw.RestApi(this, 'authApi', {
      endpointConfiguration: { types: [apiGw.EndpointType.REGIONAL] },
      defaultCorsPreflightOptions: { allowOrigins: ['*'] },
      deployOptions: { stageName: 'auth' },
    })

    // sign in function with passcode challenge
    const signIn = lambda(this, 'signIn', {timeout: defaultFunctionTimeout})
      .addEnvironment('SES_FROM_ADDRESS', process.env.SES_FROM_ADDRESS)
      .addEnvironment('BASE_URL', process.env.BASE_URL)
      .addEnvironment('USER_POOL_ID', userPool.userPoolId)
      .addEnvironment('AUTHENTICATION_CODE', process.env.AUTHENTICATION_CODE)
      .addEnvironment('FIREBASE_DYNAMIC_LINK_KEY', process.env.FIREBASE_DYNAMIC_LINK_KEY)
      .addEnvironment('FIREBASE_DYNAMIC_LINK_URL', process.env.FIREBASE_DYNAMIC_LINK_URL)
      .addEnvironment('ANDROID_PACKAGE_NAME', process.env.ANDROID_PACKAGE_NAME)
      .addEnvironment('IOS_APP_BUNDLE', process.env.IOS_APP_BUNDLE)
      .addEnvironment('IOS_APP_ID', process.env.IOS_APP_ID)
      .addEnvironment('APP_SUB_DOMAIN', process.env.APP_SUB_DOMAIN)
      .addEnvironment('ANDROID_ID_PACKAGE_NAME', process.env.ANDROID_ID_PACKAGE_NAME)
      .addEnvironment('IOS_ID_APP_BUNDLE', process.env.IOS_ID_APP_BUNDLE)
      .addEnvironment('IOS_ID_APP_ID', process.env.IOS_ID_APP_ID)
      .addEnvironment('APP_ID_SUB_DOMAIN', process.env.APP_ID_SUB_DOMAIN)
      .addEnvironment('APP_NAME', process.env.APP_NAME)
      .addEnvironment('ANDROID_REPORT_PACKAGE_NAME', process.env.ANDROID_REPORT_PACKAGE_NAME)
      .addEnvironment('IOS_REPORT_APP_BUNDLE', process.env.IOS_REPORT_APP_BUNDLE)
      .addEnvironment('IOS_REPORT_APP_ID', process.env.IOS_REPORT_APP_ID)
      .addEnvironment('APP_REPORT_SUB_DOMAIN', process.env.APP_REPORT_SUB_DOMAIN)
      .addEnvironment('REPORT_FIREBASE_DYNAMIC_LINK_KEY', process.env.REPORT_FIREBASE_DYNAMIC_LINK_KEY)
      .addEnvironment('REPORT_FIREBASE_DYNAMIC_LINK_URL', process.env.REPORT_FIREBASE_DYNAMIC_LINK_URL)
      .addEnvironment('REPORT_URL', process.env.REPORT_URL)
      .addEnvironment('REPORT_APP_NAME', process.env.REPORT_APP_NAME)

    signIn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail'],
        resources: ['*'],
      })
    )
    signIn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:AdminUpdateUserAttributes', 'cognito-idp:AdminGetUser'],
        resources: [userPool.userPoolArn],
      })
    )

    const signInMethod = new apiGw.LambdaIntegration(signIn)
    const signInApiResource = api.root.addResource('signIn')
    signInApiResource.addMethod('POST', signInMethod)

    // verify passcode challenge function
    const verifyPasscode = lambda(this, 'verify', {timeout: defaultFunctionTimeout})
      .addEnvironment('USER_POOL_ID', userPool.userPoolId)
      .addEnvironment('PASSCODE_TIMEOUT', process.env.PASSCODE_TIMEOUT)
      .addEnvironment('AUTHENTICATION_CODE', process.env.AUTHENTICATION_CODE)
    
    verifyPasscode.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cognito-idp:AdminGetUser'],
          resources: [userPool.userPoolArn],
        })
    )

    const verifyPasscodeMethod = new apiGw.LambdaIntegration(verifyPasscode)
    const verifyPasscodeApiResource = api.root.addResource('verify')
    verifyPasscodeApiResource.addMethod('POST', verifyPasscodeMethod)  

    new cdk.CfnOutput(this, 'userPoolId', {
      value: userPool.userPoolId,
    })

    new cdk.CfnOutput(this, 'clientId', {
      value: webClient.userPoolClientId,
    })
  }
}
