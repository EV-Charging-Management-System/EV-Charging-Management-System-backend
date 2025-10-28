import { NVarChar, Int, VarChar } from 'mssql'
import { getDbPool } from '../config/database'

export class CompanyService {
  // Read all companies
  async getCompanies(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`SELECT * FROM [Company]`)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching companies: ' + error)
    }
  }

  // Alias kept for compatibility if something calls getAllCompanies
  async getAllCompanies(): Promise<any[]> {
    return this.getCompanies()
  }

  async getCompanyById(companyId: number): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input('CompanyId', Int, companyId)
        .query(`SELECT * FROM [Company] WHERE CompanyId = @CompanyId`)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error('Error fetching company: ' + error)
    }
  }

  // Create a new company
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

  // Update existing company
  async updateCompany(id: number, data: { CompanyName?: string; Address?: string; Mail?: string; Phone?: string }): Promise<any | null> {
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

  // Delete a company
  async deleteCompany(id: number): Promise<boolean> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().input('CompanyId', Int, id).query(`DELETE FROM [Company] WHERE CompanyId = @CompanyId`)
      return result.rowsAffected[0] > 0
    } catch (error) {
      throw new Error('Error deleting company: ' + error)
    }
  }

  // Vehicles and history helpers (kept from previous implementation)
  async getCompanyVehicles(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input('companyId', companyId)
        .query(`SELECT * FROM [Vehicle] WHERE CompanyId = @companyId`)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching company vehicles')
    }
  }

  async addVehicleToCompany(
    companyId: number,
    vehicleName: string,
    vehicleType: string,
    licensePlate: string,
    battery: number,
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input('companyId', companyId)
        .input('vehicleName', vehicleName)
        .input('vehicleType', vehicleType)
        .input('licensePlate', licensePlate)
        .input('battery', battery)
        .query(`
          INSERT INTO [Vehicle] (CompanyId, VehicleName, VehicleType, LicensePlate, Battery)
          OUTPUT INSERTED.VehicleId
          VALUES (@companyId, @vehicleName, @vehicleType, @licensePlate, @battery)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error('Error adding vehicle to company')
    }
  }

  async removeVehicleFromCompany(vehicleId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input('vehicleId', vehicleId)
        .query(`DELETE FROM [Vehicle] WHERE VehicleId = @vehicleId`)
    } catch (error) {
      throw new Error('Error removing vehicle from company')
    }
  }

  async getCompanyHistory(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input('companyId', companyId)
        .query(`
          SELECT
            cs.SessionId,
            cs.StationId,
            cs.VehicleId,
            cs.TotalTime,
            cs.SessionPrice,
            cs.CheckinTime,
            cs.CheckoutTime,
            cs.PenaltyFee,
            v.LicensePlate,
            s.StationName
          FROM [ChargingSession] cs
          JOIN [Vehicle] v ON cs.VehicleId = v.VehicleId
          JOIN [Station] s ON cs.StationId = s.StationId
          WHERE v.CompanyId = @companyId
          ORDER BY cs.CheckinTime DESC
        `)
      return result.recordset
    } catch (error) {
      throw new Error('Error fetching company history')
    }
  }
}

export const companyService = new CompanyService()
