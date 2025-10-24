import { Int, NVarChar } from 'mssql'
import { getDbPool } from '../config/database'
import bcrypt from 'bcrypt'

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
      const result = await pool.request().input('UserId', Int, id).query(`SELECT UserId, CompanyId, UserName, Mail, RoleName FROM [User] WHERE UserId = @UserId`)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error fetching user: ' + error)
    }
  }

  async updateUser(id: number, data: { CompanyId?: number; UserName?: string; Mail?: string; PassWord?: string; RoleName?: string }): Promise<any> {
    const pool = await getDbPool()
    try {
      const existing = await this.getUserById(id)
      if (!existing) return null

      const CompanyId = data.CompanyId ?? existing.CompanyId
      const UserName = data.UserName ?? existing.UserName
      const Mail = data.Mail ?? existing.Mail
      const RoleName = data.RoleName ?? existing.RoleName

      let passwordToStore = existing.PassWord ?? null
      if (data.PassWord) {
        // Hash new password
        passwordToStore = await bcrypt.hash(data.PassWord, 10)
      }

      const request = pool.request().input('UserId', Int, id).input('CompanyId', Int, CompanyId).input('UserName', NVarChar(100), UserName).input('Mail', NVarChar(100), Mail).input('RoleName', NVarChar(50), RoleName)

      if (passwordToStore) {
        request.input('PassWord', NVarChar(100), passwordToStore)
      } else {
        request.input('PassWord', NVarChar(100), null)
      }

      const result = await request.query(`
        UPDATE [User]
        SET CompanyId = @CompanyId, UserName = @UserName, Mail = @Mail, PassWord = @PassWord, RoleName = @RoleName
        OUTPUT INSERTED.UserId, INSERTED.CompanyId, INSERTED.UserName, INSERTED.Mail, INSERTED.RoleName
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
      const subs = await pool.request().input('UserId', Int, id).query('SELECT COUNT(*) AS Count FROM Subcription WHERE UserId = @UserId')

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
      // Set RoleName to 'BUSSINESS' (as defined in DB CHECK constraint)
      const result = await pool.request().input('UserId', Int, id).input('RoleName', NVarChar(50), 'BUSSINESS').query(`
        UPDATE [User]
        SET RoleName = @RoleName
        OUTPUT INSERTED.UserId, INSERTED.CompanyId, INSERTED.UserName, INSERTED.Mail, INSERTED.RoleName
        WHERE UserId = @UserId
      `)

      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error approving user: ' + error)
    }
  }
}

export const userService = new UserService()
