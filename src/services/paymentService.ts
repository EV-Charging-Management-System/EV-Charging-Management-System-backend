import { getDbPool } from "../config/database"

export interface ProcessPaymentParams {
  userId: number
  sessionId: number
  invoiceId?: number
  amount: number
  paymentMethod: "CASH" | "QR" | "MEMBERSHIP" | "POSTPAID"
  isPostPaid?: boolean
}

export class PaymentService {
  async processPayment(params: ProcessPaymentParams): Promise<any> {
    const pool = await getDbPool()
    try {
      const paymentTime = new Date()
      const paymentStatus = params.isPostPaid ? "Pending" : "Paid"

      const result = await pool
        .request()
        .input("UserId", params.userId)
        .input("SessionId", params.sessionId)
        .input("InvoiceId", params.invoiceId || null)
        .input("TotalAmount", params.amount)
        .input("PaymentTime", paymentTime)
        .input("PaymentStatus", paymentStatus)
        .input("PaymentType", params.paymentMethod)
        .input("IsPostPaid", params.isPostPaid ? 1 : 0)
        .query(`
          INSERT INTO [Payment] (UserId, SessionId, InvoiceId, TotalAmount, PaymentTime, PaymentStatus, PaymentType, IsPostPaid)
          OUTPUT INSERTED.PaymentId
          VALUES (@UserId, @SessionId, @InvoiceId, @TotalAmount, @PaymentTime, @PaymentStatus, @PaymentType, @IsPostPaid)
        `)

      return { paymentId: result.recordset[0].PaymentId, status: paymentStatus }
    } catch (error) {
      throw new Error("Error processing payment: " + error)
    }
  }

  async createInvoice(userId: number, companyId: number | null, monthYear: string, totalAmount: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const createdAt = new Date()

      const result = await pool
        .request()
        .input("UserId", userId)
        .input("CompanyId", companyId || null)
        .input("MonthYear", monthYear)
        .input("TotalAmount", totalAmount)
        .input("PaidStatus", "Pending")
        .input("CreatedAt", createdAt)
        .query(`
          INSERT INTO [Invoice] (UserId, CompanyId, MonthYear, TotalAmount, PaidStatus, CreatedAt)
          OUTPUT INSERTED.InvoiceId
          VALUES (@UserId, @CompanyId, @MonthYear, @TotalAmount, @PaidStatus, @CreatedAt)
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error("Error creating invoice: " + error)
    }
  }

  async getPaymentHistory(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT * FROM [Payment] WHERE UserId = @UserId ORDER BY PaymentTime DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching payment history")
    }
  }

  async getInvoices(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT * FROM [Invoice] WHERE UserId = @UserId ORDER BY CreatedAt DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching invoices")
    }
  }

  async getCompanyInvoices(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("CompanyId", companyId)
        .query(`
          SELECT * FROM [Invoice] WHERE CompanyId = @CompanyId ORDER BY CreatedAt DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching company invoices")
    }
  }

  async getPendingPayments(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT * FROM [Payment] WHERE UserId = @UserId AND PaymentStatus = 'Pending'
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching pending payments")
    }
  }

  async payInvoice(invoiceId: number, paymentMethod: string): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("InvoiceId", invoiceId)
        .input("PaymentMethod", paymentMethod)
        .query(`
          UPDATE [Invoice] SET PaidStatus = 'Paid' WHERE InvoiceId = @InvoiceId
        `)
    } catch (error) {
      throw new Error("Error paying invoice")
    }
  }

  async getMonthlyReport(userId: number, monthYear: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .input("MonthYear", monthYear)
        .query(`
          SELECT 
            SUM(TotalAmount) as TotalSpent,
            COUNT(*) as SessionCount,
            AVG(TotalAmount) as AvgSessionCost
          FROM [Payment]
          WHERE UserId = @UserId AND CONVERT(VARCHAR(7), PaymentTime, 121) = @MonthYear
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching monthly report")
    }
  }
}

export const paymentService = new PaymentService()
