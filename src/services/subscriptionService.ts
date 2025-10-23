import { Int, NVarChar, Date as SqlDate } from 'mssql'
import { getDbPool } from '../config/database'

class SubscriptionService {
  async getAllSubscriptions(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`SELECT * FROM [Subcription]`)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching subscriptions: ' + error)
    }
  }

  async getSubscriptionById(id: number): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('SubcriptionId', Int, id).query(`SELECT * FROM [Subcription] WHERE SubcriptionId = @SubcriptionId`)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error fetching subscription: ' + error)
    }
  }

  async createSubscription(data: { UserId?: number; CompanyId?: number; PackageId: number; StartMonth?: string; StartDate: string; DurationMonth?: string }): Promise<any> {
    const pool = await getDbPool()
    try {
      const { UserId = null, CompanyId = null, PackageId, StartMonth = null, StartDate, DurationMonth = null } = data
      const result = await pool
        .request()
        .input('UserId', Int, UserId)
        .input('CompanyId', Int, CompanyId)
        .input('PackageId', Int, PackageId)
        .input('StartMonth', NVarChar(100), StartMonth)
        .input('StartDate', SqlDate, StartDate)
        .input('DurationMonth', NVarChar(100), DurationMonth)
        .query(`
          INSERT INTO [Subcription] (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth)
          OUTPUT INSERTED.*
          VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error('Error creating subscription: ' + error)
    }
  }

  async updateSubscription(id: number, data: { UserId?: number; CompanyId?: number; PackageId?: number; StartMonth?: string; StartDate?: string; DurationMonth?: string }): Promise<any> {
    const pool = await getDbPool()
    try {
      const existing = await this.getSubscriptionById(id)
      if (!existing) return null

      const UserId = data.UserId ?? existing.UserId
      const CompanyId = data.CompanyId ?? existing.CompanyId
      const PackageId = data.PackageId ?? existing.PackageId
      const StartMonth = data.StartMonth ?? existing.StartMonth
      const StartDate = data.StartDate ?? existing.StartDate
      const DurationMonth = data.DurationMonth ?? existing.DurationMonth

      const result = await pool
        .request()
        .input('SubcriptionId', Int, id)
        .input('UserId', Int, UserId)
        .input('CompanyId', Int, CompanyId)
        .input('PackageId', Int, PackageId)
        .input('StartMonth', NVarChar(100), StartMonth)
        .input('StartDate', SqlDate, StartDate)
        .input('DurationMonth', NVarChar(100), DurationMonth)
        .query(`
          UPDATE [Subcription]
          SET UserId = @UserId, CompanyId = @CompanyId, PackageId = @PackageId, StartMonth = @StartMonth, StartDate = @StartDate, DurationMonth = @DurationMonth
          OUTPUT INSERTED.*
          WHERE SubcriptionId = @SubcriptionId
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error('Error updating subscription: ' + error)
    }
  }

  async deleteSubscription(id: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('SubcriptionId', Int, id).query(`DELETE FROM [Subcription] WHERE SubcriptionId = @SubcriptionId`)
      return result.rowsAffected[0] > 0
    } catch (error) {
      throw new Error('Error deleting subscription: ' + error)
    }
  }
}

export const subscriptionService = new SubscriptionService()
