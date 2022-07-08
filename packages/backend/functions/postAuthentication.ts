import { PostAuthenticationTriggerHandler } from 'aws-lambda'
import { CognitoIdentityServiceProvider } from 'aws-sdk'

const cisp = new CognitoIdentityServiceProvider()

export const handler: PostAuthenticationTriggerHandler = async (event) => {
  if (event.request.userAttributes?.email_verified !== 'true') {
      var groupResponse = await cisp.adminListGroupsForUser({
        UserPoolId: event.userPoolId,
        Username: event.userName,
      }).promise()
      // verify email and add user to group new if they're not belong to any group
      if(groupResponse.Groups == null || groupResponse.Groups.length == 0) {
        await Promise.all([
          cisp.adminUpdateUserAttributes({
          UserPoolId: event.userPoolId,
          UserAttributes: [
            {
              Name: 'email_verified',
              Value: 'true',
            },
          ],
          Username: event.userName,
        }).promise(),
          cisp.adminAddUserToGroup({
            UserPoolId: event.userPoolId,
            Username: event.userName,
            GroupName: 'new'
          }).promise()
        ])
      }
  }
  return event
}
