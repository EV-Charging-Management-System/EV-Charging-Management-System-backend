import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { vehicleService } from "../services/vehicleService"

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
}

export const vehicleController = new VehicleController()
