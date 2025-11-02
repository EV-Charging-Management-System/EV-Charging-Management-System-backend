import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { chargingSessionService } from "../services/chargingSessionService"

export class ChargingSessionController {
  async startSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bookingId, vehicleId, stationId, pointId, portId, batteryPercentage } = req.body

      if (!bookingId || !vehicleId || !stationId || !pointId || !portId || batteryPercentage === undefined) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const session = await chargingSessionService.startSession(bookingId, vehicleId, stationId, pointId, portId, batteryPercentage)
      res.status(201).json({ success: true, data: session })
    } catch (error) {
      next(error)
    }
  }

  async endSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const result = await chargingSessionService.endSession(Number(id))
      res.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  async getSessionDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const session = await chargingSessionService.getSessionDetails(Number(id))

      if (!session) {
        res.status(404).json({ message: "Session not found" })
        return
      }

      res.status(200).json({ success: true, data: session })
    } catch (error) {
      next(error)
    }
  }

  async getUserSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const sessions = await chargingSessionService.getUserSessions(userId)
      res.status(200).json({ success: true, data: sessions })
    } catch (error) {
      next(error)
    }
  }

  async getCompanySessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params
      const sessions = await chargingSessionService.getCompanySessions(Number(companyId))
      res.status(200).json({ success: true, data: sessions })
    } catch (error) {
      next(error)
    }
  }

  async addPenalty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { penaltyFee } = req.body

      if (!penaltyFee) {
        res.status(400).json({ message: "Penalty fee is required" })
        return
      }

      await chargingSessionService.addPenalty(Number(id), penaltyFee)
      res.json({ success: true, message: "Penalty added successfully" })
    } catch (error) {
      next(error)
    }
  }

  async calculateSessionPrice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { discountPercent } = req.query

      const price = await chargingSessionService.calculateSessionPrice(Number(id), Number(discountPercent) || 0)
      res.json({ success: true, data: { price } })
    } catch (error) {
      next(error)
    }
  }
  async generateInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      const { id } = req.params
      const invoice = await chargingSessionService.generateInvoiceService(Number(id), userId  || 0)
      res.status(201).json({ success: true, data: invoice })
    } catch (error) {
      next(error)
    }
  }
}


export const chargingSessionController = new ChargingSessionController()
