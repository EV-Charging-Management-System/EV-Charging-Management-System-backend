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

  // Business methods used by controllers
  async buyForUser(userId: number, packageId: number, durationMonths = 1, companyId: number | null = null): Promise<any> {
    const pool = await getDbPool()
    try {
      const startDate = new Date()
      const startMonth = startDate.toLocaleString('en-US', { month: 'long' })
      const result = await pool
        .request()
        .input('UserId', Int, userId)
        .input('CompanyId', Int, companyId)
        .input('PackageId', Int, packageId)
        .input('StartMonth', NVarChar(100), startMonth)
        .input('StartDate', SqlDate, startDate)
        .input('DurationMonth', NVarChar(100), String(durationMonths))
        .query(`
          INSERT INTO [Subcription] (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth)
          OUTPUT INSERTED.*
          VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth)
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error('Error buying subscription for user: ' + error)
    }
  }

  async buyForCompany(companyId: number, packageId: number, durationMonths = 1, userId: number | null = null): Promise<any> {
    // A company purchase still writes a Subcription row. We keep optional userId for traceability.
    const pool = await getDbPool()
    try {
      const startDate = new Date()
      const startMonth = startDate.toLocaleString('en-US', { month: 'long' })
      const result = await pool
        .request()
        .input('UserId', Int, userId)
        .input('CompanyId', Int, companyId)
        .input('PackageId', Int, packageId)
        .input('StartMonth', NVarChar(100), startMonth)
        .input('StartDate', SqlDate, startDate)
        .input('DurationMonth', NVarChar(100), String(durationMonths))
        .query(`
          INSERT INTO [Subcription] (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth)
          OUTPUT INSERTED.*
          VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth)
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error('Error buying subscription for company: ' + error)
    }
  }

  async getStatusByUserId(userId: number): Promise<{ subscription: any | null; active: boolean; expiresAt?: Date | null }>
  {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('UserId', Int, userId).query(`SELECT TOP 1 * FROM [Subcription] WHERE UserId = @UserId ORDER BY StartDate DESC`)
      const subscription = result.recordset[0] || null
      if (!subscription) return { subscription: null, active: false, expiresAt: null }

      const duration = Number(subscription.DurationMonth) || 0
      const start = new Date(subscription.StartDate)
      const expiresAt = new Date(start)
      expiresAt.setMonth(expiresAt.getMonth() + duration)
      const active = expiresAt > new Date()
      return { subscription, active, expiresAt }
    } catch (error) {
      throw new Error('Error fetching subscription status: ' + error)
    }
  }

  async renewSubscriptionById(subcriptionId: number, addMonths = 1): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const existing = await this.getSubscriptionById(subcriptionId)
      if (!existing) return null
      const currentDuration = Number(existing.DurationMonth) || 0
      const newDuration = currentDuration + addMonths
      const result = await pool
        .request()
        .input('SubcriptionId', Int, subcriptionId)
        .input('DurationMonth', NVarChar(100), String(newDuration))
        .query(`
          UPDATE [Subcription]
          SET DurationMonth = @DurationMonth
          OUTPUT INSERTED.*
          WHERE SubcriptionId = @SubcriptionId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error('Error renewing subscription: ' + error)
    }
  }

  async renewLatestByUserId(userId: number, addMonths = 1): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const latest = await pool.request().input('UserId', Int, userId).query(`SELECT TOP 1 * FROM [Subcription] WHERE UserId = @UserId ORDER BY StartDate DESC`)
      const sub = latest.recordset[0]
      if (!sub) return null
      return this.renewSubscriptionById(sub.SubcriptionId, addMonths)
    } catch (error) {
      throw new Error('Error renewing latest subscription for user: ' + error)
    }
  }

  async cancelSubscriptionById(subcriptionId: number): Promise<boolean> {
    // For simplicity, delete the subscription row to cancel
    return this.deleteSubscription(subcriptionId)
  }

  async cancelLatestByUserId(userId: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      const latest = await pool.request().input('UserId', Int, userId).query(`SELECT TOP 1 * FROM [Subcription] WHERE UserId = @UserId ORDER BY StartDate DESC`)
      const sub = latest.recordset[0]
      if (!sub) return false
      return this.deleteSubscription(sub.SubcriptionId)
    } catch (error) {
      throw new Error('Error cancelling latest subscription for user: ' + error)
    }
  }
}

export const subscriptionService = new SubscriptionService()
