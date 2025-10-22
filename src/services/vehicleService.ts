import { getDbPool } from "../config/database"
import { randomInt } from "crypto"

class VehicleService {
  async addVehicle(userId: number, companyId: number, vehicleName: string, licensePlate: string, battery: number): Promise<any> {       
  const pool = await getDbPool()
  try {
    battery = randomInt(20, 100)
    await pool
      .request()
      .input("UserId", userId)
      .input("CompanyId", companyId)
      .input("VehicleName", vehicleName)
      .input("LicensePlate", licensePlate)
      .input("Battery", battery)
      .query(`
        INSERT INTO [Vehicle] (UserId, CompanyId, VehicleName, LicensePlate, Battery)
        VALUES (@UserId, @CompanyId, @VehicleName, @LicensePlate, @Battery)
      `)

    return { vehicleName, licensePlate, battery }
  } catch (error) {
    throw new Error("Error adding vehicle: " + error)
  }
}

}

export const vehicleService = new VehicleService()