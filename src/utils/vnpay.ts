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
  returnUrl?: string
}

export const buildVnpUrl = ({ amount, orderInfo, txnRef, ipAddr, returnUrl }: BuildVnpUrlParams): string => {
  const vnpay = ((config as any).vnpay || {
    url: process.env.VNP_URL,
    tmnCode: process.env.VNP_TMN_CODE,
    hashSecret: process.env.VNP_HASH_SECRET,
    // Fallback: env VNP_RETURN_URL or VNP_RETURNURL; default dev URL if missing
    returnUrl: process.env.VNP_RETURN_URL || process.env.VNP_RETURNURL || "http://localhost:3000/vnpay-return",
    ipnUrl: process.env.VNP_IPN_URL,
  }) as {
    url?: string
    tmnCode?: string
    hashSecret?: string
    returnUrl?: string
    ipnUrl?: string
  }

  const missing: string[] = []
  if (!vnpay.tmnCode) missing.push("VNP_TMN_CODE")
  if (!vnpay.hashSecret) missing.push("VNP_HASH_SECRET")
  if (!vnpay.url) missing.push("VNP_URL")

  if (missing.length) {
    // Log the current vnpay configuration so it's easy to debug which values are missing.
    // We redact the secret when logging to avoid leaking sensitive values.
    console.error("VNPAY config:", {
      tmnCode: vnpay.tmnCode,
      hashSecret: vnpay.hashSecret ? "***REDACTED***" : vnpay.hashSecret,
      url: vnpay.url,
      returnUrl: returnUrl || vnpay.returnUrl,
      ipnUrl: vnpay.ipnUrl,
    })

    throw new Error(`VNPAY configuration is incomplete. Missing: ${missing.join(", ")}`)
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
    vnp_ReturnUrl: returnUrl || vnpay.returnUrl,
    vnp_IpAddr: ipAddr || "127.0.0.1",
    vnp_CreateDate: createDate,
  }

  const sortedParams = sortObject(vnp_Params)
  const signData = qs.stringify(sortedParams, { encode: false })

  const hmac = crypto.createHmac("sha512", vnpay.hashSecret as string)
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

  const hash = crypto.createHmac("sha512", vnpay.hashSecret as string).update(signData, "utf-8").digest("hex")

    return hash === secureHash
  } catch {
    return false
  }
}
