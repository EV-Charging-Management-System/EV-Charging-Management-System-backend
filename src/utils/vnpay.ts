import crypto from "crypto"
import qs from "qs"
import dotenv from "dotenv"
import { config } from "../config/config"

dotenv.config()

export interface BuildVnpUrlParams {
  amount: number
  orderInfo: string
  txnRef: string
  ipAddr?: string
}

export const buildVnpUrl = ({ amount, orderInfo, txnRef, ipAddr }: BuildVnpUrlParams): string => {
  const vnpay = ((config as any).vnpay || {
    url: process.env.VNP_URL,
    tmnCode: process.env.VNP_TMN_CODE,
    hashSecret: process.env.VNP_HASH_SECRET,
    returnUrl: process.env.VNP_RETURN_URL,
    ipnUrl: process.env.VNP_IPN_URL,
  }) as {
    url?: string
    tmnCode?: string
    hashSecret?: string
    returnUrl?: string
    ipnUrl?: string
  }

  if (!vnpay.tmnCode || !vnpay.hashSecret || !vnpay.url || !vnpay.returnUrl) {
    throw new Error("VNPAY configuration is incomplete")
  }

  const date = new Date()
  const createDate = date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)

  const vnp_Params: Record<string, any> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: vnpay.tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "billpayment",
    vnp_Amount: Math.round(Number(amount)) * 100, // VND in cents
    vnp_ReturnUrl: vnpay.returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: createDate,
  }

  const sortedParams = sortObject(vnp_Params)
  const signData = qs.stringify(sortedParams, { encode: false })

  const hmac = crypto.createHmac("sha512", vnpay.hashSecret)
  const secureHash = hmac.update(signData, "utf-8").digest("hex")

  const finalUrl = `${vnpay.url}?${signData}&vnp_SecureHash=${secureHash}`
  return finalUrl
}

const sortObject = (obj: Record<string, any>) => {
  const sorted: Record<string, string> = {}
  const keys = Object.keys(obj).sort()

  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+")
  }

  return sorted
}

export const verifyVnpReturn = (query: Record<string, string>): boolean => {
  try {
    const vnpay = ((config as any).vnpay || { hashSecret: process.env.VNP_HASH_SECRET }) as { hashSecret?: string }

    if (!vnpay.hashSecret) {
      return false
    }

    const secureHash = query.vnp_SecureHash
    if (!secureHash) {
      return false
    }

    const queryParams = { ...query }
    delete queryParams.vnp_SecureHash
    delete queryParams.vnp_SecureHashType

    const sortedParams = sortObject(queryParams)
    const signData = qs.stringify(sortedParams, { encode: false })

    const hash = crypto.createHmac("sha512", vnpay.hashSecret).update(signData, "utf-8").digest("hex")

    return hash === secureHash
  } catch {
    return false
  }
}
