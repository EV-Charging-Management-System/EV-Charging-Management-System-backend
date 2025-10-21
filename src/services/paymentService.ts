import crypto from 'crypto'
import qs from 'querystring'
import { config } from '../config/config'

export interface CreatePaymentInput {
  amount: number // VND
  orderInfo: string
  orderId: string
  bankCode?: string
}

const sortObject = (obj: Record<string, string | number>) => {
  const sorted: Record<string, string> = {}
  const keys = Object.keys(obj).sort()
  keys.forEach((key) => {
    sorted[key] = String(obj[key])
  })
  return sorted
}

export const buildPaymentUrl = (input: CreatePaymentInput, clientIp: string): string => {
  const tmnCode = config.vnpay.tmnCode
  const secretKey = config.vnpay.hashSecret
  const vnpUrl = config.vnpay.url

  const createDate = new Date()
  const vnp_CreateDate =
    createDate.getFullYear().toString() +
    String(createDate.getMonth() + 1).padStart(2, '0') +
    String(createDate.getDate()).padStart(2, '0') +
    String(createDate.getHours()).padStart(2, '0') +
    String(createDate.getMinutes()).padStart(2, '0') +
    String(createDate.getSeconds()).padStart(2, '0')

  const params: Record<string, string | number> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Locale: config.vnpay.locale,
    vnp_CurrCode: config.vnpay.currCode,
    vnp_TxnRef: input.orderId,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: input.amount * 100, // VND to smallest unit
    vnp_ReturnUrl: config.vnpay.returnUrl,
    vnp_IpAddr: clientIp,
    vnp_CreateDate,
  }

  if (input.bankCode) {
    params['vnp_BankCode'] = input.bankCode
  }

  const sorted = sortObject(params)
  const signData = qs.stringify(sorted, undefined, undefined, {
    encodeURIComponent: (str) => encodeURIComponent(str).replace(/%20/g, '+'),
  })
  const hmac = crypto.createHmac('sha512', secretKey)
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')
  const paymentUrl = `${vnpUrl}?${signData}&vnp_SecureHash=${signed}`
  return paymentUrl
}

export const verifyVnpReturn = (query: Record<string, string | string[]>): boolean => {
  const secretKey = config.vnpay.hashSecret
  const params: Record<string, string> = {}
  Object.keys(query).forEach((key) => {
    const val = query[key]
    params[key] = Array.isArray(val) ? val[0] : val
  })
  const secureHash = params['vnp_SecureHash']
  delete params['vnp_SecureHash']
  delete params['vnp_SecureHashType']
  const sorted = sortObject(params)
  const signData = qs.stringify(sorted, undefined, undefined, {
    encodeURIComponent: (str) => encodeURIComponent(str).replace(/%20/g, '+'),
  })
  const signed = crypto.createHmac('sha512', secretKey).update(Buffer.from(signData, 'utf-8')).digest('hex')
  if (process.env.NODE_ENV !== 'production') {
    // Debug logs to diagnose signature mismatches during development
    // Do NOT enable in production environments
    // eslint-disable-next-line no-console
    console.log('[VNPay verify] sorted params:', sorted)
    // eslint-disable-next-line no-console
    console.log('[VNPay verify] signData    :', signData)
    // eslint-disable-next-line no-console
    console.log('[VNPay verify] provided    :', secureHash)
    // eslint-disable-next-line no-console
    console.log('[VNPay verify] expected    :', signed)
  }
  return secureHash?.toLowerCase() === signed.toLowerCase()
}
