declare namespace NodeJS {
  export interface ProcessEnv {
    AWS_REGION: string
    SES_FROM_ADDRESS: string
    BASE_URL: string
    EMAIL_BODY: string
    EMAIL_TEXT: string
    EMAIL_SUBJECT: string
    USER_POOL_ID: string
  }
}
