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
    APP_SUB_DOMAIN: string

    ANDROID_ID_PACKAGE_NAME: string
    IOS_ID_APP_BUNDLE: string
    IOS_ID_APP_ID: string
    APP_ID_SUB_DOMAIN: string

    ANDROID_REPORT_PACKAGE_NAME: string
    IOS_REPORT_APP_BUNDLE: string
    IOS_REPORT_APP_ID: string
    APP_REPORT_SUB_DOMAIN: string
    REPORT_FIREBASE_DYNAMIC_LINK_KEY: string
    REPORT_FIREBASE_DYNAMIC_LINK_URL: string
    REPORT_URL: string
    REPORT_APP_NAME: string

    // Whatsapp
    WHATSAPP_APP_ID: string
    WHATSAPP_APP_KEY: string
    WHATSAPP_TEMPLATE_NAME: string
  }
}
