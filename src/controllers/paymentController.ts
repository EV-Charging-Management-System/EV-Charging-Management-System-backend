import type { Request, Response, RequestHandler } from 'express'
import { buildPaymentUrl, verifyVnpReturn } from '../services/paymentService'
import type { AuthRequest } from '../middlewares/authMiddleware'
import { config } from '../config/config'

export const createPayment: RequestHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, orderInfo, bankCode } = req.body as { amount?: number; orderInfo?: string; bankCode?: string }

    // Basic input validation
    if (amount == null || !orderInfo) {
      res.status(400).json({ message: 'amount và orderInfo là bắt buộc' })
      return
    }

    // VNPay requires amount in VND (integer). Practical sandbox minimum is typically >= 2000 VND
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ message: 'amount phải là số VND hợp lệ (> 0)' })
      return
    }
    if (amount < 2000) {
      res.status(400).json({ message: 'amount quá nhỏ. Vui lòng dùng >= 2000 VND để test VNPay sandbox' })
      return
    }

    if (typeof orderInfo !== 'string' || orderInfo.trim().length === 0) {
      res.status(400).json({ message: 'orderInfo không hợp lệ' })
      return
    }

    // Config validation to avoid generating invalid paymentUrl
    if (!config.vnpay.tmnCode || !config.vnpay.hashSecret) {
      res.status(500).json({
        message:
          'Thiếu cấu hình VNPay. Vui lòng thiết lập VNPAY_TMN_CODE và VNPAY_HASH_SECRET trong .env rồi khởi động lại server'
      })
      return
    }

    const orderId = `${Date.now()}`
    const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || '127.0.0.1'

    const url = buildPaymentUrl({ amount: Number(amount), orderInfo, orderId, bankCode }, clientIp)
    res.json({ paymentUrl: url, orderId })
    return
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
    return
  }
}

export const vnpayReturn: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const isValid = verifyVnpReturn(req.query as Record<string, string | string[]>)
    if (!isValid) {
      res.status(400).json({ message: 'Invalid signature' })
      return
    }
    // Business handling: update order status by vnp_TxnRef and vnp_ResponseCode
    res.json({ success: true, data: req.query })
    return
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
    return
  }
}

export const vnpayIpn: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const isValid = verifyVnpReturn(req.query as Record<string, string | string[]>)
    if (!isValid) {
      res.status(200).json({ RspCode: '97', Message: 'Invalid signature' })
      return
    }
    // TODO: check order status, amount, and process accordingly
    res.status(200).json({ RspCode: '00', Message: 'Confirm Success' })
    return
  } catch (e) {
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' })
    return
  }
}
