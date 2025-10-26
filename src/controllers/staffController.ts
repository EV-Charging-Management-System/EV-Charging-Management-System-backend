import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { staffService } from "../services/staffService"

export class StaffController {
  async getVehicleByPlate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { licensePlate } = req.params
      const vehicle = await staffService.getVehicleByPlate(licensePlate)
      if (!vehicle) {
        res.status(404).json({ message: "Vehicle not found" })
        return
      }
      res.status(200).json({ success: true, data: vehicle })
    } catch (error) {
      next(error)
    }
  }

  async startDirectSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vehicleId, stationId, portId, batteryPercentage } = req.body

      if (!vehicleId || !stationId || batteryPercentage === undefined) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const session = await staffService.startDirectSession(vehicleId, stationId, portId, batteryPercentage)
      res.status(201).json({ success: true, data: session })
    } catch (error) {
      next(error)
    }
  }

  async endDirectSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params
      const result = await staffService.endDirectSession(Number(sessionId))
      res.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  async processDirectPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, amount, paymentMethod } = req.body

      if (!sessionId || !amount || !paymentMethod) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const payment = await staffService.processDirectPayment(sessionId, amount, paymentMethod)
      res.status(201).json({ success: true, data: payment })
    } catch (error) {
      next(error)
    }
  }

  async getStationSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = req.params
      const sessions = await staffService.getStationSessions(Number(stationId))
      res.status(200).json({ success: true, data: sessions })
    } catch (error) {
      next(error)
    }
  }

  async addPenalty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params
      const { penaltyFee } = req.body

      if (!penaltyFee) {
        res.status(400).json({ message: "Penalty fee is required" })
        return
      }

      await staffService.addPenaltyToSession(Number(sessionId), penaltyFee)
      res.json({ success: true, message: "Penalty added successfully" })
    } catch (error) {
      next(error)
    }
  }
}

export const staffController = new StaffController()
