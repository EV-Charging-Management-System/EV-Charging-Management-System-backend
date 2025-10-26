import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { paymentService } from "../services/paymentService"

export class PaymentController {
  async processPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, amount, paymentMethod, isPostPaid } = req.body
      const userId = req.user?.userId

      if (!userId || !sessionId || !amount || !paymentMethod) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const payment = await paymentService.processPayment({
        userId,
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
    try {
      const { monthYear, totalAmount,companyId } = req.body
      const userId = req.user?.userId

      if (!userId || !monthYear || !totalAmount) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const invoice = await paymentService.createInvoice(userId, companyId, monthYear, totalAmount)
      res.status(201).json({ success: true, data: invoice })
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

      const invoices = await paymentService.getInvoices(userId)
      res.status(200).json({ success: true, data: invoices })
    } catch (error) {
      next(error)
    }
  }

  async getCompanyInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params
      const invoices = await paymentService.getCompanyInvoices(Number(companyId))
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
      const { paymentMethod } = req.body

      if (!paymentMethod) {
        res.status(400).json({ message: "Payment method is required" })
        return
      }

      await paymentService.payInvoice(Number(id), paymentMethod)
      res.json({ success: true, message: "Invoice paid successfully" })
    } catch (error) {
      next(error)
    }
  }

  async getMonthlyReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      const { monthYear } = req.query

      if (!userId || !monthYear) {
        res.status(400).json({ message: "Missing required parameters" })
        return
      }

      const report = await paymentService.getMonthlyReport(userId, monthYear as string)
      res.status(200).json({ success: true, data: report })
    } catch (error) {
      next(error)
    }
  }
}

export const paymentController = new PaymentController()
