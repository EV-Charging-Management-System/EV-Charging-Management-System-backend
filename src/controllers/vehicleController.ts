import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { vehicleService } from "../services/vehicleService"
import { membershipService } from "../services/membershipService"

export class VehicleController {
  async getVehicles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const vehicles = await vehicleService.getVehicles(userId)
      res.status(200).json({ success: true, data: vehicles })
    } catch (error) {
      next(error)
    }
  }

  async getVehicleById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const vehicle = await vehicleService.getVehicleById(Number(id))
      if (!vehicle) {
        res.status(404).json({ message: "Vehicle not found" })
        return
      }
      res.status(200).json({ success: true, data: vehicle })
    } catch (error) {
      next(error)
    }
  }

  async addVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vehicleName, vehicleType, licensePlate, battery } = req.body
      const userId = req.user?.userId

      if (!userId || !vehicleName || !vehicleType || !licensePlate) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const result = await vehicleService.addVehicle(userId, vehicleName, vehicleType, licensePlate, battery)
      res.status(201).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  async updateVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { vehicleName, vehicleType, licensePlate } = req.body

      if (!vehicleName || !vehicleType || !licensePlate) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      await vehicleService.updateVehicle(Number(id), vehicleName, vehicleType, licensePlate)
      res.json({ success: true, message: "Vehicle updated successfully" })
    } catch (error) {
      next(error)
    }
  }

  async deleteVehicle(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await vehicleService.deleteVehicle(Number(id))
      res.json({ success: true, message: "Vehicle deleted successfully" })
    } catch (error) {
      next(error)
    }
  }

  // Lookup: by license plate -> return company info (and subscription if available)
  async getCompanyByLicensePlate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plate = (req.query.plate as string) || (req.params.plate as string)
      if (!plate) {
        res.status(400).json({ message: "Missing plate parameter" })
        return
      }

      const info = await vehicleService.getCompanyByLicensePlate(plate)
      if (!info) {
        res.status(404).json({ message: "Vehicle not found" })
        return
      }

      let subscription: any = null
      if (info.CompanyId) {
        const sub = await membershipService.getCompanySubscription(info.CompanyId)
        if (sub) {
          const startDate = new Date(sub.StartDate)
          const expireDate = new Date(startDate)
          const duration = Number(sub.DurationMonth || 0)
          if (!Number.isNaN(duration)) expireDate.setMonth(startDate.getMonth() + duration)
          const now = new Date()
          const statusDerived = now > expireDate ? "EXPIRED" : "ACTIVE"

          subscription = {
            PackageId: sub.PackageId,
            PackageName: sub.PackageName,
            PackagePrice: sub.PackagePrice,
            StartDate: sub.StartDate,
            DurationMonth: sub.DurationMonth,
            ExpireDate: expireDate,
            status: statusDerived,
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          vehicleId: info.VehicleId,
          licensePlate: info.LicensePlate,
          userId: info.UserId,
          companyId: info.CompanyId || null,
          companyName: info.CompanyName || null,
          subscription,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export const vehicleController = new VehicleController()
