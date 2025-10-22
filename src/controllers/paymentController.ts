import type { AuthRequest } from "@/middlewares/authMiddleware"
import { asyncHandler } from "../middlewares/errorMiddleware"
import { paymentService } from "../services/paymentService"
import type { NextFunction, Response } from "express"

class PaymentController {
  // Process payment
  processPayment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookingId, amount, paymentMethod, sessionId } = req.body
      const userId = req.user?.userId

      if (!userId || !bookingId || !amount || !paymentMethod) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const payment = await paymentService.processPayment({
        userId,
        bookingId,
        amount,
        paymentMethod,
        sessionId,
      })

      res.status(200).json({ data: payment, message: "Payment processed successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Get payment history
  getPaymentHistory = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const payments = await paymentService.getPaymentHistory(userId)
      res.status(200).json({ data: payments, message: "Payment history fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Get pending payments (trả sau)
  getPendingPayments = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const payments = await paymentService.getPendingPayments(userId)
      res.status(200).json({ data: payments, message: "Pending payments fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Pay pending balance
  payPendingBalance = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { amount, paymentMethod } = req.body
      const userId = req.user?.userId

      if (!userId || !amount || !paymentMethod) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const result = await paymentService.payPendingBalance(userId, amount, paymentMethod)
      res.status(200).json({ data: result, message: "Pending balance paid successfully" })
    } catch (error) {
      next(error)
    }
  })
}

export const paymentController = new PaymentController()
