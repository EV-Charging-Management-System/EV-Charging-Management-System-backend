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

  // Admin/Staff can query any user; EVDRIVER/BUSINESS can only query themselves
  async getVehiclesByUserId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params
      const requesterId = req.user?.userId
      const role = req.user?.role

      if (!userId) {
        res.status(400).json({ message: "Missing userId parameter" })
        return
      }

      // All authorized roles (ADMIN, STAFF, EVDRIVER, BUSINESS) are allowed to query vehicles by userId
      const vehicles = await vehicleService.getVehicles(Number(userId))
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

  // Register vehicle by plate; create if not exists; update if exists and belongs to user; conflict if belongs to another user
  async registerByPlate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { licensePlate, vehicleName, vehicleType, battery } = req.body
      const userId = req.user?.userId
      const role = req.user?.role

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }
      if (!licensePlate) {
        res.status(400).json({ message: "licensePlate is required" })
        return
      }

      const result = await vehicleService.registerByPlate({
        userId,
        role,
        licensePlate,
        vehicleName,
        vehicleType,
        battery,
      })

      if (result.status === "created") {
        res.status(201).json({
          message: "Vehicle registered successfully",
          vehicle: result.vehicle,
        })
        return
      }

      if (result.status === "updated") {
        res.status(200).json({
          message: "Vehicle updated successfully",
          vehicle: result.vehicle,
        })
        return
      }

      if (result.status === "attached-company") {
        res.status(200).json({
          message: "Vehicle attached to company successfully",
          vehicle: result.vehicle,
        })
        return
      }

      if (result.status === "exists-other-user") {
        res.status(409).json({ message: "Vehicle already exists and owned by another user" })
        return
      }

  // no other statuses expected
  res.status(500).json({ message: "Unexpected response" })
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
          battery: info.Battery ?? null,
          subscription,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export const vehicleController = new VehicleController()
