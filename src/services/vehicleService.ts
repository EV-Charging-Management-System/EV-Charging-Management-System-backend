import { getDbPool } from "../config/database"
import { randomInt } from "crypto"

export class VehicleService {
  async getVehicles(userId: number): Promise<any[]> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("UserId", userId)
        .query(`
          SELECT * FROM [Vehicle] WHERE UserId = @UserId
        `)
      return result.recordset
    } catch (error) {
      throw new Error("Error fetching vehicles")
    }
  }

  async getVehicleById(vehicleId: number): Promise<any> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("VehicleId", vehicleId)
        .query(`
          SELECT * FROM [Vehicle] WHERE VehicleId = @VehicleId
        `)
      return result.recordset[0]
    } catch (error) {
      throw new Error("Error fetching vehicle")
    }
  }

  async addVehicle(
    userId: number,
    vehicleName: string,
    vehicleType: string,
    licensePlate: string,
    battery?: number,
  ): Promise<any> {
    const pool = await getDbPool()
    try {
      const randomBattery = battery || randomInt(20, 100)

      const result = await pool
        .request()
        .input("UserId", userId)
        .input("VehicleName", vehicleName)
        .input("VehicleType", vehicleType)
        .input("LicensePlate", licensePlate)
        .input("Battery", randomBattery)
        .query(`
          INSERT INTO [Vehicle] (UserId, VehicleName, VehicleType, LicensePlate, Battery)
          OUTPUT INSERTED.VehicleId
          VALUES (@UserId, @VehicleName, @VehicleType, @LicensePlate, @Battery)
        `)

      return { vehicleId: result.recordset[0].VehicleId, vehicleName, licensePlate, battery: randomBattery }
    } catch (error) {
      throw new Error("Error adding vehicle: " + error)
    }
  }

  async updateVehicle(
    vehicleId: number,
    vehicleName: string,
    vehicleType: string,
    licensePlate: string,
  ): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("VehicleId", vehicleId)
        .input("VehicleName", vehicleName)
        .input("VehicleType", vehicleType)
        .input("LicensePlate", licensePlate)
        .query(`
          UPDATE [Vehicle]
          SET VehicleName = @VehicleName, VehicleType = @VehicleType, LicensePlate = @LicensePlate
          WHERE VehicleId = @VehicleId
        `)
    } catch (error) {
      throw new Error("Error updating vehicle")
    }
  }

  async deleteVehicle(vehicleId: number): Promise<void> {
    const pool = await getDbPool()
    try {
      await pool
        .request()
        .input("VehicleId", vehicleId)
        .query(`
          DELETE FROM [Vehicle] WHERE VehicleId = @VehicleId
        `)
    } catch (error) {
      throw new Error("Error deleting vehicle")
    }
  }

  async getCompanyByLicensePlate(licensePlate: string): Promise<any | null> {
    const pool = await getDbPool()
    try {
      const result = await pool
        .request()
        .input("LicensePlate", licensePlate)
        .query(`
          SELECT TOP 1
            v.VehicleId,
            v.LicensePlate,
            u.UserId,
            u.CompanyId,
            c.CompanyName
          FROM [Vehicle] v
          JOIN [User] u ON v.UserId = u.UserId
          LEFT JOIN [Company] c ON u.CompanyId = c.CompanyId
          WHERE v.LicensePlate = @LicensePlate
        `)
      return result.recordset[0] || null
    } catch (error) {
      throw new Error("Error looking up company by license plate")
    }
  }
}

export const vehicleService = new VehicleService()
