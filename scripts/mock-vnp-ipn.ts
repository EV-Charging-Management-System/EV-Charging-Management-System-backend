/**
 * Helper script to generate a signed VNPAY IPN query for local testing.
 *
 * Usage (PowerShell):
 *   $env:VNP_HASH_SECRET="<your_secret>"
 *   node -r ts-node/register scripts/mock-vnp-ipn.ts "vnp_Amount=5000000&vnp_Command=pay&...&vnp_TxnRef=B_3_4_1_1761731116415"
 *
 * Output:
 *   vnp_Amount=...&...&vnp_ResponseCode=00&vnp_TransactionStatus=00&vnp_SecureHash=<calculated>
 *
 * Then call:
 *   http://localhost:5000/api/vnpay/ipn?{OUTPUT}
 */

import crypto from "crypto"
import qs from "qs"

const secret = process.env.VNP_HASH_SECRET
if (!secret) {
  console.error("VNP_HASH_SECRET is not set in environment.")
  process.exit(1)
}

const input = process.argv.slice(2).join(" ")
if (!input) {
  console.error("Provide base query string as argument. Example: vnp_Amount=5000000&...&vnp_TxnRef=B_3_4_1_123456789")
  process.exit(1)
}

// Parse existing query into object
const parsed = qs.parse(input, { ignoreQueryPrefix: true }) as Record<string, any>

// Remove existing signature fields if any
delete parsed["vnp_SecureHash"]
delete parsed["vnp_SecureHashType"]

// Ensure success result codes for IPN
parsed["vnp_ResponseCode"] = parsed["vnp_ResponseCode"] || "00"
parsed["vnp_TransactionStatus"] = parsed["vnp_TransactionStatus"] || "00"

// Sort like server's implementation
const sortObject = (obj: Record<string, any>) => {
  const sorted: Record<string, string> = {}
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    const val = obj[key]
    const s = val == null ? "" : String(val)
    sorted[key] = encodeURIComponent(s).replace(/%20/g, "+")
  }
  return sorted
}

const sortedParams = sortObject(parsed)
const signData = qs.stringify(sortedParams, { encode: false })

const hmac = crypto.createHmac("sha512", secret)
const secureHash = hmac.update(signData, "utf-8").digest("hex")

const finalQuery = signData + "&vnp_SecureHash=" + secureHash
console.log(finalQuery)
