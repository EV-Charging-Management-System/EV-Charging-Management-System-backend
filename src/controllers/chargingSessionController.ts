import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { chargingSessionService } from "../services/chargingSessionService"
import { getDbPool } from "../config/database"

export class ChargingSessionController {
  async startSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bookingId, vehicleId, stationId, pointId, portId, batteryPercentage } = req.body

      if (!bookingId || !vehicleId || !stationId || !pointId || !portId || batteryPercentage === undefined) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const session = await chargingSessionService.startSession(bookingId, vehicleId, stationId, pointId, portId, batteryPercentage)
      res.status(201).json({
        success: true,
        message: "Charging session started successfully",
        data: {
          sessionId: session.sessionId,
          stationId,
          vehicleId,
          startTime: session.checkinTime,
          status: session.chargingStatus,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  async endSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await chargingSessionService.endSession(Number(id))

      const sessionId = Number(id)
      const pool = await getDbPool()
      const sessionRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT SessionId, CheckinTime, CheckoutTime, TotalTime, PortId, SessionPrice, PenaltyFee FROM [ChargingSession] WHERE SessionId = @SessionId`)
      const cs = sessionRes.recordset[0]
      if (!cs) {
        res.status(404).json({ success: false, message: "Session not found" })
        return
      }
      const portRes = await pool
        .request()
        .input("PortId", cs.PortId)
        .query(`SELECT PortTypeOfKwh FROM [ChargingPort] WHERE PortId = @PortId`)
      const port = portRes.recordset[0]
      const start = new Date(cs.CheckinTime)
      const end = new Date(cs.CheckoutTime)
      const durationMinutes = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (60 * 1000)))
      const energyUsed = Number(durationMinutes) * Number(port?.PortTypeOfKwh || 0)
      res.json({
        success: true,
        message: "Charging session ended successfully",
        data: {
          sessionId,
          energyUsed,
          sessionPrice: Number(cs.SessionPrice) || 0,
          endTime: cs.CheckoutTime,
          status: "COMPLETED",
        },
      })
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
      if (penaltyFee === undefined) {
        res.status(400).json({ success: false, message: "Penalty fee is required" })
        return
      }
      const sessionId = Number(id)
      await chargingSessionService.addPenalty(sessionId, Number(penaltyFee))

      const pool = await getDbPool()
      const sRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT SessionPrice, PenaltyFee FROM [ChargingSession] WHERE SessionId = @SessionId`)
      const s = sRes.recordset[0] || { SessionPrice: 0, PenaltyFee: 0 }

      res.json({
        success: true,
        message: "Penalty fee added successfully",
        data: {
          sessionId,
          sessionPrice: Number(s.SessionPrice) || 0,
          penaltyFee: Number(s.PenaltyFee) || 0,
          totalWithPenalty: Number(s.SessionPrice || 0) + Number(s.PenaltyFee || 0),
        },
      })
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
      const sessionId = Number(id)
      await chargingSessionService.generateInvoiceService(sessionId, userId  || 0)

      const pool = await getDbPool()
      const invRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT TOP 1 InvoiceId, TotalAmount as totalAmount, PaidStatus FROM [Invoice] WHERE SessionId = @SessionId ORDER BY InvoiceId DESC`)
      const inv = invRes.recordset[0]
      const sRes = await pool
        .request()
        .input("SessionId", sessionId)
        .query(`SELECT SessionPrice, PenaltyFee FROM [ChargingSession] WHERE SessionId = @SessionId`)
      const s = sRes.recordset[0] || { SessionPrice: 0, PenaltyFee: 0 }

      res.status(201).json({
        success: true,
        message: "Invoice generated and stored successfully",
        data: {
          invoiceId: inv?.InvoiceId || null,
          sessionId,
          sessionPrice: Number(s.SessionPrice) || 0,
          penaltyFee: Number(s.PenaltyFee) || 0,
          totalAmount: Number(inv?.totalAmount || (s.SessionPrice || 0) + (s.PenaltyFee || 0)),
          PaidStatus: String(inv?.PaidStatus ?? "Pending"),
          createdAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  }
  // Staff/Admin can explicitly assign invoice to a provided userId for a session
  async generateInvoiceByStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user?.role
      if (role !== "STAFF" && role !== "ADMIN") {
        res.status(403).json({ success: false, message: "Forbidden" })
        return
      }
      const { id } = req.params
      const { userId } = req.body
      if (!userId) {
        res.status(400).json({ success: false, message: "userId is required in body" })
        return
      }
      const sessionId = Number(id)
      const upsert = await chargingSessionService.upsertInvoiceByStaff(sessionId, Number(userId))
      res.status(201).json({
        success: true,
        message: "Invoice created/updated successfully",
        data: {
          invoiceId: upsert.invoiceId,
          sessionId,
          userId: Number(userId),
          totalAmount: upsert.totalAmount,
          paidStatus: upsert.paidStatus,
          createdAt: new Date().toISOString(),
        },
      })
    } catch (error) {
      next(error)
    }
  }
  async startSessionByStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId, pointId, portId, licensePlate, batteryPercentage } = req.body
      if (!stationId || !pointId || !portId || !licensePlate || batteryPercentage === undefined) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const session = await chargingSessionService.startSessionStaff(stationId, pointId, portId, licensePlate, batteryPercentage)
      res.status(201).json({ success: true, data: session })
    }
    catch (error) {
      next(error)
    }
  }
  async endSessionByStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const result = await chargingSessionService.endSession(Number(id))
      res.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  async startSessionForGuest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId, pointId, portId, battery, batteryPercentage } = req.body

      if (!stationId || !pointId || !portId || battery === undefined || batteryPercentage === undefined) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const session = await chargingSessionService.startSessionForGuest(stationId, pointId, portId, battery, batteryPercentage)
      res.status(201).json({ success: true, data: session })
    } catch (error) {
      next(error)
    }
  }
  async endSessionForGuest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const result = await chargingSessionService.endSession(Number(id))
      res.json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }
  async getSessionDetailsGuest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const session = await chargingSessionService.getSessionDetailsGuest(Number(id))
      if (!session) {
        res.status(404).json({ message: "Session not found" })
        return
      }
      res.json({ success: true, data: session })
    } catch (error) {
      next(error)
    }
  } 
 async updateBatteryPercentage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, batteryPercentage } = req.body;

    if (batteryPercentage === undefined) {
      res.status(400).json({ success: false, message: "batteryPercentage is required" });
      return;
    }

    const updated = await chargingSessionService.updateBatteryPercentage(Number(id), batteryPercentage);

    if (!updated) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Battery percentage updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error in updateBatteryPercentage:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}


}



export const chargingSessionController = new ChargingSessionController()