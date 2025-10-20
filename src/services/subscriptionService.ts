import { getDbPool } from '../config/database'
import { Int, NVarChar, Date as SqlDate } from 'mssql'

export interface SubscriptionDTO {
  SubcriptionId: number
  UserId: number
  CompanyId: number
  PackageId: number
  StartMonth: string | null
  StartDate: Date | null
  DurationMonth: string | null
}

export interface CreateSubscriptionInput {
  UserId: number
  CompanyId: number
  PackageId: number
  StartMonth?: string | null
  StartDate?: Date | null
  DurationMonth?: string | null
}

class SubscriptionService {
  async create(input: CreateSubscriptionInput): Promise<SubscriptionDTO> {
    const pool = await getDbPool()
    const result = await pool
      .request()
      .input('UserId', Int, input.UserId)
      .input('CompanyId', Int, input.CompanyId)
      .input('PackageId', Int, input.PackageId)
      .input('StartMonth', NVarChar(100), input.StartMonth ?? null)
      .input('StartDate', SqlDate, input.StartDate ?? null)
      .input('DurationMonth', NVarChar(100), input.DurationMonth ?? '1')
      .query(
        `INSERT INTO [Subcription] (UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth)
         VALUES (@UserId, @CompanyId, @PackageId, @StartMonth, @StartDate, @DurationMonth);
         SELECT SCOPE_IDENTITY() AS id;`
      )
    const id = Number(result.recordset[0].id)
    return (await this.getById(id)) as SubscriptionDTO
  }

  async getById(id: number): Promise<SubscriptionDTO | null> {
    const pool = await getDbPool()
    const res = await pool.request().input('id', Int, id).query<SubscriptionDTO>('SELECT * FROM [Subcription] WHERE SubcriptionId = @id')
    return res.recordset[0] || null
  }

  async listByUser(userId: number): Promise<SubscriptionDTO[]> {
    const pool = await getDbPool()
    const res = await pool
      .request()
      .input('userId', Int, userId)
      .query<SubscriptionDTO>('SELECT * FROM [Subcription] WHERE UserId = @userId ORDER BY SubcriptionId DESC')
    return res.recordset
  }

  async renew(subscriptionId: number): Promise<SubscriptionDTO | null> {
    const pool = await getDbPool()
    // Gia hạn thêm 1 chu kỳ: tăng DurationMonth lên 1 (nếu null => 1)
    await pool
      .request()
      .input('id', Int, subscriptionId)
      .query(
        `UPDATE [Subcription]
         SET DurationMonth = CASE WHEN DurationMonth IS NULL THEN '1' ELSE CAST(CAST(DurationMonth AS INT) + 1 AS NVARCHAR(100)) END
         WHERE SubcriptionId = @id`
      )
    return this.getById(subscriptionId)
  }

  async cancel(subscriptionId: number): Promise<boolean> {
    const pool = await getDbPool()
    const res = await pool.request().input('id', Int, subscriptionId).query('DELETE FROM [Subcription] WHERE SubcriptionId = @id')
    return res.rowsAffected[0] > 0
  }
}

export const subscriptionService = new SubscriptionService()
