import dotenv from 'dotenv'
import path from 'path'

// Load env from project root by default
dotenv.config()
// Also attempt to load from src/.env (in case env file is placed there during development)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

export const config = {
  port: Number.parseInt(process.env.PORT || '3000'),

  database: {
      server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
    database: process.env.DB_NAME || 'EVCharStation',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '12345',
    port: Number.parseInt(process.env.DB_PORT || '1433'),
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'hackhocai',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'hackhocai',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  },

  vnpay: {
    // Accept both VNPAY_* and VNP_* prefixes
    tmnCode: process.env.VNPAY_TMN_CODE || process.env.VNP_TMN_CODE || '',
    hashSecret: process.env.VNPAY_HASH_SECRET || process.env.VNP_HASH_SECRET || '',
    url: process.env.VNPAY_URL || process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: process.env.VNPAY_RETURN_URL || process.env.VNP_RETURN_URL || 'http://localhost:3000/api/payment/vnpay-return',
  ipnUrl: process.env.VNPAY_IPN_URL || process.env.VNP_IPN_URL || 'http://localhost:3000/api/payment/vnpay-ipn',
    locale: process.env.VNPAY_LOCALE || 'vn',
    currCode: 'VND'
  },


  // email: {
  //   host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  //   port: Number.parseInt(process.env.EMAIL_PORT || '587'),
  //   secure: process.env.EMAIL_SECURE === 'true',
  //   user: process.env.EMAIL_USER || '',
  //   password: process.env.EMAIL_PASSWORD || ''
  // },

  // upload: {
  //   maxFileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  //   allowedTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword']
  // },

  admin: {
    email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@electricvehicle.com',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!'
  },

  nodeEnv: process.env.NODE_ENV || 'development'
}
