import { NVarChar, Int } from 'mssql'
import { getDbPool } from '../config/database'

class CompanyService {
  async getAllCompanies(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`SELECT * FROM [Company]`)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching companies: ' + error)
    }
  }

  async getCompanyById(id: number): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input('CompanyId', Int, id)
        .query(`SELECT * FROM [Company] WHERE CompanyId = @CompanyId`)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error fetching company: ' + error)
    }
  }

  async createCompany(data: { CompanyName: string; Address?: string; Mail?: string; Phone?: string }): Promise<any> {
    const pool = await getDbPool()
    try {
      const { CompanyName, Address = null, Mail = null, Phone = null } = data
      const result = await pool
        .request()
        .input('CompanyName', NVarChar(100), CompanyName)
        .input('Address', NVarChar(100), Address)
        .input('Mail', NVarChar(100), Mail)
        .input('Phone', NVarChar(100), Phone)
        .query(`
          INSERT INTO [Company] (CompanyName, Address, Mail, Phone)
          OUTPUT INSERTED.*
          VALUES (@CompanyName, @Address, @Mail, @Phone)
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error('Error creating company: ' + error)
    }
  }

  async updateCompany(id: number, data: { CompanyName?: string; Address?: string; Mail?: string; Phone?: string }): Promise<any> {
    const pool = await getDbPool()
    try {
      const existing = await this.getCompanyById(id)
      if (!existing) return null

      const CompanyName = data.CompanyName ?? existing.CompanyName
      const Address = data.Address ?? existing.Address
      const Mail = data.Mail ?? existing.Mail
      const Phone = data.Phone ?? existing.Phone

      const result = await pool
        .request()
        .input('CompanyId', Int, id)
        .input('CompanyName', NVarChar(100), CompanyName)
        .input('Address', NVarChar(100), Address)
        .input('Mail', NVarChar(100), Mail)
        .input('Phone', NVarChar(100), Phone)
        .query(`
          UPDATE [Company]
          SET CompanyName = @CompanyName, Address = @Address, Mail = @Mail, Phone = @Phone
          OUTPUT INSERTED.*
          WHERE CompanyId = @CompanyId
        `)

      return result.recordset[0]
    } catch (error) {
      throw new Error('Error updating company: ' + error)
    }
  }

  async deleteCompany(id: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('CompanyId', Int, id).query(`DELETE FROM [Company] WHERE CompanyId = @CompanyId`)
      return result.rowsAffected[0] > 0
    } catch (error) {
      throw new Error('Error deleting company: ' + error)
    }
  }
}

export const companyService = new CompanyService()
