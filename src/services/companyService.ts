import { getDbPool } from "../config/database"

export class CompanyService {
  async getCompanies(): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool.request().query(`
        SELECT * FROM [Company]
      `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching companies")
    }
  }

  async getCompanyById(companyId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("companyId", companyId)
        .query(`
          SELECT * FROM [Company] WHERE CompanyId = @companyId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching company")
    }
  }

  async getCompanyVehicles(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("companyId", companyId)
        .query(`
          SELECT * FROM [Vehicle] WHERE CompanyId = @companyId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching company vehicles")
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
        .input("companyId", companyId)
        .input("vehicleName", vehicleName)
        .input("vehicleType", vehicleType)
        .input("licensePlate", licensePlate)
        .input("battery", battery)
        .query(`
          INSERT INTO [Vehicle] (CompanyId, VehicleName, VehicleType, LicensePlate, Battery)
          OUTPUT INSERTED.VehicleId
          VALUES (@companyId, @vehicleName, @vehicleType, @licensePlate, @battery)
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error adding vehicle to company")
    }
  }

  async removeVehicleFromCompany(vehicleId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("vehicleId", vehicleId)
        .query(`
          DELETE FROM [Vehicle] WHERE VehicleId = @vehicleId
        `)
    } catch (error) {
      throw new Error("Error removing vehicle from company")
    }
  }

  async getCompanyHistory(companyId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("companyId", companyId)
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
      throw new Error("Error fetching company history")
    }
  }
}

export const companyService = new CompanyService()
