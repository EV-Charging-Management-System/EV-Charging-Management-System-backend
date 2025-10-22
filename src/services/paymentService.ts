import { NVarChar, DateTime, Decimal, Int } from "mssql"
import { getDbPool } from "../config/database"

interface ProcessPaymentParams {
  userId: number
  bookingId: number
  amount: number
  paymentMethod: "CASH" | "TRANSFER" | "QR" | "MEMBERSHIP"
  sessionId?: string
}

class PaymentService {
  async processPayment(params: ProcessPaymentParams): Promise<any> {
    const pool = await getDbPool()
    try {
      const paymentId = `PAY_${Date.now()}`
      const status = "COMPLETED"
      const createdAt = new Date()

      const result = await pool
        .request()
        .input("PaymentId", NVarChar, paymentId)
        .input("UserId", Int, params.userId)
        .input("BookingId", Int, params.bookingId)
        .input("Amount", Decimal, params.amount)
        .input("PaymentMethod", NVarChar, params.paymentMethod)
        .input("Status", NVarChar, status)
        .input("CreatedAt", DateTime, createdAt)
        .query(`
          INSERT INTO [Payment] (PaymentId, UserId, BookingId, Amount, PaymentMethod, Status, CreatedAt)
          VALUES (@PaymentId, @UserId, @BookingId, @Amount, @PaymentMethod, @Status, @CreatedAt)
        `)

      // Update booking status
      await pool
        .request()
        .input("BookingId", NVarChar, params.bookingId)
        .query(`UPDATE [Booking] SET Status = 'CONFIRMED' WHERE BookingId = @BookingId`)

      return { paymentId, status, message: "Payment successful" }
    } catch (error) {
      throw new Error("Error processing payment")
    }
  }

  async getPaymentHistory(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT * FROM [Payment] WHERE UserId = @UserId ORDER BY CreatedAt DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching payment history")
    }
  }

  async getPendingPayments(userId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", Int, userId)
        .query(`
          SELECT SUM(Amount) as TotalPending FROM [Payment] 
          WHERE UserId = @UserId AND Status = 'PENDING'
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching pending payments")
    }
  }

  async payPendingBalance(userId: number, amount: number, paymentMethod: string): Promise<any> {
    const pool = await getDbPool()
    try {
      const paymentId = `PAY_${Date.now()}`
      const createdAt = new Date()

      await pool
        .request()
        .input("PaymentId", NVarChar, paymentId)
        .input("UserId", Int, userId)
        .input("Amount", Decimal, amount)
        .input("PaymentMethod", NVarChar, paymentMethod)
        .input("CreatedAt", DateTime, createdAt)
        .query(`
          INSERT INTO [Payment] (PaymentId, UserId, Amount, PaymentMethod, Status, CreatedAt)
          VALUES (@PaymentId, @UserId, @Amount, @PaymentMethod, 'COMPLETED', @CreatedAt)
        `)

      return { message: "Pending balance paid successfully" }
    } catch (error) {
      throw new Error("Error paying pending balance")
    }
  }
}

export const paymentService = new PaymentService()
