import { getDbPool } from "../config/database"

export interface ProcessPaymentParams {

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
      const userId = await pool.request().input("SessionId", params.sessionId).query(`SELECT v.UserId FROM [ChargingSession] cs JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId WHERE cs.SessionId = @SessionId`);
      const paymentStatus = params.isPostPaid ? "Pending" : "Paid"

      const result = await pool
        .request()
        .input("UserId", userId.recordset[0].UserId || null)
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

  // Pay all pending invoices of a user and create a single payment record
  async payAllPendingInvoices(userId: number, paymentType: string): Promise<{
    paymentId: number | null
    userId: number
    totalAmount: number
    paymentType: string
    paymentStatus: string
    paidInvoices: Array<{ invoiceId: number; amount: number }>
    createdAt: string
  }> {
    const pool = await getDbPool()
    try {
      // 1) Fetch all pending invoices for the user
      const pending = await pool
        .request()
        .input("UserId", userId)
        .query(`SELECT InvoiceId, TotalAmount FROM [Invoice] WHERE UserId = @UserId AND PaidStatus = 'Pending' AND SessionId IS NOT NULL`)

      const invoices: Array<{ invoiceId: number; amount: number }> = pending.recordset.map((r: any) => ({
        invoiceId: r.InvoiceId,
        amount: Number(r.TotalAmount || 0),
      }))

      if (invoices.length === 0) {
        const now = new Date()
        const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
          now.getDate()
        ).padStart(2, "0")}`
        return {
          paymentId: null,
          userId,
          totalAmount: 0,
          paymentType,
          paymentStatus: "NothingToPay",
          paidInvoices: [],
          createdAt,
        }
      }

      const totalAmount = invoices.reduce((sum, it) => sum + it.amount, 0)

      // 2) Create a single Payment record for the total
      const paymentTime = new Date()
      const insertPayment = await pool
        .request()
        .input("UserId", userId)
        .input("TotalAmount", totalAmount)
        .input("PaymentTime", paymentTime)
        .input("PaymentStatus", "Paid")
        .input("PaymentType", paymentType)
        .input("IsPostPaid", 0)
        .query(`
          INSERT INTO [Payment] (UserId, SessionId, InvoiceId, TotalAmount, PaymentTime, PaymentStatus, PaymentType, IsPostPaid)
          OUTPUT INSERTED.PaymentId
          VALUES (@UserId, NULL, NULL, @TotalAmount, @PaymentTime, @PaymentStatus, @PaymentType, @IsPostPaid)
        `)
      const paymentId: number = insertPayment.recordset[0]?.PaymentId

      // 3) Mark those invoices as Paid
      // Build a parameterized IN clause
      const idParams = invoices.map((_, idx) => `@id${idx}`).join(",")
      const req = pool.request().input("UserId", userId)
      invoices.forEach((inv, idx) => req.input(`id${idx}`, inv.invoiceId))
      await req.query(`UPDATE [Invoice] SET PaidStatus = 'Paid' WHERE UserId = @UserId AND InvoiceId IN (${idParams})`)

      const createdAt = `${paymentTime.getFullYear()}-${String(paymentTime.getMonth() + 1).padStart(2, "0")}-${String(
        paymentTime.getDate()
      ).padStart(2, "0")}`

      return {
        paymentId,
        userId,
        totalAmount,
        paymentType,
        paymentStatus: "Paid",
        paidInvoices: invoices,
        createdAt,
      }
    } catch (error) {
      throw new Error("Error paying all pending invoices: " + error)
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

  // New: Only invoices created from charging sessions
  async getSessionInvoices(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT * FROM [Invoice]
          WHERE UserId = @UserId AND SessionId IS NOT NULL
          ORDER BY InvoiceId DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching session invoices")
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

  // New: Only company invoices created from charging sessions
  async getCompanySessionInvoices(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("CompanyId", companyId)
        .query(`
          SELECT * FROM [Invoice]
          WHERE CompanyId = @CompanyId AND SessionId IS NOT NULL
          ORDER BY InvoiceId DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching company session invoices")
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
      // 1. Check invoice existence & current status
      const existing = await pool
        .request()
        .input("InvoiceId", invoiceId)
        .query(`SELECT InvoiceId, PaidStatus FROM [Invoice] WHERE InvoiceId = @InvoiceId`)

      if (existing.recordset.length === 0) {
        throw new Error(`Invoice ${invoiceId} not found`) // Will be caught below and wrapped
      }

      const currentStatus = existing.recordset[0].PaidStatus
      if (currentStatus === "Paid") {
        throw new Error(`Invoice ${invoiceId} is already paid`) // Prevent misleading success response
      }

      // 2. Perform update
      const updateResult = await pool
        .request()
        .input("InvoiceId", invoiceId)
        .input("PaymentMethod", paymentMethod)
        .query(`UPDATE [Invoice] SET PaidStatus = 'Paid' WHERE InvoiceId = @InvoiceId`)

      // 3. Validate that a row was actually affected (defensive, though existence was checked)
      if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
        throw new Error(`Failed to update invoice ${invoiceId}`)
      }
    } catch (error) {
      throw new Error("Error paying invoice: " + (error instanceof Error ? error.message : String(error)))
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

  // New: get summary for all months for a user
  async getMonthlyReports(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT 
            CONVERT(VARCHAR(7), PaymentTime, 121) AS MonthYear,
            SUM(TotalAmount) AS TotalSpent,
            COUNT(*) AS SessionCount,
            AVG(TotalAmount) AS AvgSessionCost
          FROM [Payment]
          WHERE UserId = @UserId
          GROUP BY CONVERT(VARCHAR(7), PaymentTime, 121)
          ORDER BY MonthYear DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching monthly reports")
    }
  }
}

export const paymentService = new PaymentService()
