import type { AuthRequest } from "@/middlewares/authMiddleware"
import { asyncHandler } from "../middlewares/errorMiddleware"
import { chargingSessionService } from "../services/chargingSessionService"
import type { NextFunction, Response } from "express"

class ChargingSessionController {
  // Start charging session
  startSession = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookingId, qrCode } = req.body
      const userId = req.user?.userId

      if (!userId || !bookingId || !qrCode) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const session = await chargingSessionService.startSession(bookingId, userId, qrCode)
      res.status(201).json({ data: session, message: "Charging session started" })
    } catch (error) {
      next(error)
    }
  })

  // End charging session
  endSession = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params
      const userId = req.user?.userId

      if (!userId || !sessionId) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const result = await chargingSessionService.endSession(Number.parseInt(sessionId), userId)
      res.status(200).json({ data: result, message: "Charging session ended" })
    } catch (error) {
      next(error)
    }
  })

  // Get session details
  getSessionDetails = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params
      const session = await chargingSessionService.getSessionDetails(Number.parseInt(sessionId))

      if (!session) {
        res.status(404).json({ message: "Session not found" })
        return
      }

      res.status(200).json({ data: session, message: "Session details fetched" })
    } catch (error) {
      next(error)
    }
  })

  // Get user sessions
  getUserSessions = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const sessions = await chargingSessionService.getUserSessions(userId)
      res.status(200).json({ data: sessions, message: "User sessions fetched" })
    } catch (error) {
      next(error)
    }
  })

  // Calculate penalty
  calculatePenalty = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params
      const penalty = await chargingSessionService.calculatePenalty(Number.parseInt(sessionId))

      res.status(200).json({ data: penalty, message: "Penalty calculated" })
    } catch (error) {
      next(error)
    }
  })
}

export const chargingSessionController = new ChargingSessionController()
