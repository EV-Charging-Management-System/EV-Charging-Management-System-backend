import { Int, NVarChar, Bit } from 'mssql'
import { getDbPool } from '../config/database'
import bcrypt from 'bcrypt'
import { validateEmail } from '../utils/validation'

class UserService {
  async getAllUsers(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`SELECT UserId, CompanyId, UserName, Mail, RoleName FROM [User]`)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching users: ' + error)
    }
  }

  async getUserById(id: number): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input('UserId', Int, id)
        .query(
          `SELECT UserId, CompanyId, StationId, IsPremium, UserName, Mail, RoleName FROM [User] WHERE UserId = @UserId`
        )
      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error fetching user: ' + error)
    }
  }

  async updateUser(
    id: number,
    data: {
      CompanyId?: number | null
      StationId?: number | null
      IsPremium?: boolean
      UserName?: string
      Mail?: string
      PassWord?: string
      RoleName?: string
    }
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      // Fetch full existing row (including password hash) for safe defaults
      const existingRs = await pool
        .request()
        .input('UserId', Int, id)
        .query(
          `SELECT UserId, CompanyId, StationId, IsPremium, UserName, Mail, PassWord, RoleName FROM [User] WHERE UserId = @UserId`
        )
      const existing = existingRs.recordset[0]
      if (!existing) return null

      const allowedRoles = ['ADMIN', 'STAFF', 'EVDRIVER', 'BUSINESS']

      const CompanyId = data.CompanyId !== undefined ? data.CompanyId : existing.CompanyId
      const StationId = data.StationId !== undefined ? data.StationId : existing.StationId
      const IsPremium = data.IsPremium !== undefined ? data.IsPremium : existing.IsPremium
      const UserName = data.UserName ?? existing.UserName
      const Mail = data.Mail ?? existing.Mail
      const RoleName = data.RoleName ?? existing.RoleName

      // Validate email format and uniqueness if changed
      if (data.Mail) {
        if (!validateEmail(data.Mail)) throw new Error('Invalid email format')
        const dup = await pool
          .request()
          .input('Mail', NVarChar(100), data.Mail)
          .input('UserId', Int, id)
          .query(`SELECT COUNT(*) AS C FROM [User] WHERE Mail = @Mail AND UserId <> @UserId`)
        if (dup.recordset[0]?.C > 0) throw new Error('Email already in use')
      }

      // Validate role if provided
      if (data.RoleName && !allowedRoles.includes(data.RoleName)) {
        throw new Error(`Invalid RoleName. Allowed: ${allowedRoles.join(', ')}`)
      }

      // Validate foreign keys if provided
      if (data.CompanyId !== undefined && data.CompanyId !== null) {
        const ck = await pool
          .request()
          .input('CompanyId', Int, data.CompanyId)
          .query(`SELECT COUNT(*) AS C FROM [Company] WHERE CompanyId = @CompanyId`)
        if (ck.recordset[0]?.C === 0) throw new Error('CompanyId does not exist')
      }
      if (data.StationId !== undefined && data.StationId !== null) {
        const ck = await pool
          .request()
          .input('StationId', Int, data.StationId)
          .query(`SELECT COUNT(*) AS C FROM [Station] WHERE StationId = @StationId`)
        if (ck.recordset[0]?.C === 0) throw new Error('StationId does not exist')
      }

      // Password hashing if provided
      let passwordToStore: string | null = existing.PassWord
      if (data.PassWord) {
        passwordToStore = await bcrypt.hash(data.PassWord, 10)
      }

      const request = pool
        .request()
        .input('UserId', Int, id)
  .input('CompanyId', Int, CompanyId as any)
  .input('StationId', Int, StationId as any)
        .input('IsPremium', Bit, IsPremium)
        .input('UserName', NVarChar(100), UserName)
        .input('Mail', NVarChar(100), Mail)
        .input('RoleName', NVarChar(50), RoleName)
        .input('PassWord', NVarChar(100), passwordToStore)

      const result = await request.query(`
        UPDATE [User]
        SET CompanyId = @CompanyId,
            StationId = @StationId,
            IsPremium = @IsPremium,
            UserName = @UserName,
            Mail = @Mail,
            PassWord = @PassWord,
            RoleName = @RoleName
        OUTPUT INSERTED.UserId, INSERTED.CompanyId, INSERTED.StationId, INSERTED.IsPremium, INSERTED.UserName, INSERTED.Mail, INSERTED.RoleName
        WHERE UserId = @UserId
      `)

      return result.recordset[0]
    } catch (error) {
      throw new Error('Error updating user: ' + error)
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      // Prevent deleting users who have subscriptions to preserve history
      const subs = await pool
        .request()
        .input('UserId', Int, id)
        .query('SELECT COUNT(*) AS Count FROM Subscription WHERE UserId = @UserId')

      if (subs.recordset && subs.recordset[0] && subs.recordset[0].Count > 0) {
        throw new Error('Cannot delete user with active subscriptions.')
      }

      const result = await pool.request().input('UserId', Int, id).query(`DELETE FROM [User] WHERE UserId = @UserId`)
      return result.rowsAffected[0] > 0
    } catch (error) {
      throw new Error('Error deleting user: ' + error)
    }
  }

  async approveUser(id: number): Promise<any> {
    const pool = await getDbPool()
    try {
      // Set RoleName to 'BUSINESS' (as defined in DB CHECK constraint)
      const result = await pool
        .request()
        .input('UserId', Int, id)
        .input('RoleName', NVarChar(50), 'BUSINESS')
        .query(`
        UPDATE [User]
        SET RoleName = @RoleName
        OUTPUT INSERTED.UserId, INSERTED.CompanyId, INSERTED.StationId, INSERTED.IsPremium, INSERTED.UserName, INSERTED.Mail, INSERTED.RoleName
        WHERE UserId = @UserId
      `)

      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error approving user: ' + error)
    }
  }
}

export const userService = new UserService()
