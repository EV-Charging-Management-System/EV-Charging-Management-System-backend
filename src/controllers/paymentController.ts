import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { paymentService } from "../services/paymentService"

export class PaymentController {
  async payAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokenUserId = req.user?.userId
      const { userId: bodyUserId, paymentType } = req.body || {}

      const userId = Number(bodyUserId ?? tokenUserId)
      if (!userId || !paymentType) {
        res.status(400).json({ message: "Missing required fields: userId, paymentType" })
        return
      }

      // Optional: ensure the caller pays only for themselves
      if (tokenUserId && bodyUserId && Number(bodyUserId) !== tokenUserId) {
        res.status(403).json({ message: "Forbidden" })
        return
      }

      const result = await paymentService.payAllPendingInvoices(userId, String(paymentType))

      res.status(200).json({
        success: true,
        data: {
          paymentId: result.paymentId,
          userId: result.userId,
          totalAmount: result.totalAmount,
          paymentType: result.paymentType,
          paymentStatus: result.paymentStatus,
          paidInvoices: result.paidInvoices,
          createdAt: result.createdAt,
        },
      })
    } catch (error) {
      next(error)
    }
  }
  async processPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, amount, paymentMethod, isPostPaid } = req.body
     

      if ( !sessionId || !amount || !paymentMethod) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const payment = await paymentService.processPayment({
    
        sessionId,
        amount,
        paymentMethod,
        isPostPaid,
      })

      res.status(201).json({ success: true, data: payment })
    } catch (error) {
      next(error)
    }
  }

  async createInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    // Deprecated: invoices are generated within charging session flow. Keep for backward compatibility if still called.
    try {
      res.status(410).json({
        success: false,
        message: "Deprecated endpoint: Invoice creation now handled by /charging-sessions/:id/invoice",
      })
    } catch (error) {
      next(error)
    }
  }

  async getPaymentHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const payments = await paymentService.getPaymentHistory(userId)
      res.status(200).json({ success: true, data: payments })
    } catch (error) {
      next(error)
    }
  }

  async getInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }
      // Fetch ONLY invoices tied to charging sessions (session-based invoices)
      const invoices = await paymentService.getSessionInvoices(userId)
      res.status(200).json({ success: true, data: invoices })
    } catch (error) {
      next(error)
    }
  }

  async getCompanyInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params
      const invoices = await paymentService.getCompanySessionInvoices(Number(companyId))
      res.status(200).json({ success: true, data: invoices })
    } catch (error) {
      next(error)
    }
  }

  async getPendingPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const payments = await paymentService.getPendingPayments(userId)
      res.status(200).json({ success: true, data: payments })
    } catch (error) {
      next(error)
    }
  }

  async payInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      // Make paymentMethod optional; default to CASH if none provided (bodyless support)
      const bodyMethod = (req.body?.paymentMethod ?? req.body?.method) as string | undefined
      const queryMethod = (req.query?.paymentMethod ?? req.query?.method) as string | undefined
      const resolvedMethod = String((bodyMethod ?? queryMethod ?? "CASH")).toUpperCase()

      const allowedMethods = new Set(["CASH", "QR", "MEMBERSHIP", "POSTPAID"])
      if (!allowedMethods.has(resolvedMethod)) {
        res.status(400).json({ message: "Invalid payment method", allowed: Array.from(allowedMethods) })
        return
      }

      await paymentService.payInvoice(Number(id), resolvedMethod)
      res.json({ success: true, message: "Invoice paid successfully" })
    } catch (error) {
      next(error)
    }
  }

  async getMonthlyReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      // Return all month summaries instead of a single month
      const reports = await paymentService.getMonthlyReports(userId)
      res.status(200).json({ success: true, data: reports })
    } catch (error) {
      next(error)
    }
  }
}

export const paymentController = new PaymentController()
