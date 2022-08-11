declare namespace NodeJS {
  export interface ProcessEnv {
    AWS_REGION: string
    SES_FROM_ADDRESS: string
    BASE_URL: string
    USER_POOL_ID: string
    PASSCODE_TIMEOUT: string
    AUTHENTICATION_CODE: string // code to protect functions from unauthorized access
    FIREBASE_DYNAMIC_LINK_KEY: string
    FIREBASE_DYNAMIC_LINK_URL: string
    ANDROID_PACKAGE_NAME: string
    IOS_APP_BUNDLE: string
    IOS_APP_ID: string
    APP_NAME: string
  }
}
