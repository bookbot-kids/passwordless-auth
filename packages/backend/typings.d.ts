declare namespace NodeJS {
  export interface ProcessEnv {
    AWS_REGION: string
    SES_FROM_ADDRESS: string
    BASE_URL: string
    USER_POOL_ID: string
    PASSCODE_TIMEOUT: string
    AUTHENTICATION_CODE: string // code to protect functions from unauthorized access
  }
}
