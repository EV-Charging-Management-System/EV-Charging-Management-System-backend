import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { bookingService } from "../services/bookingService"

export class BookingController {
  async createBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId, vehicleId } = req.body
      const userId = req.user?.userId

      if (!userId || !stationId || !vehicleId) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const booking = await bookingService.createBooking({
        userId,
        stationId,
        vehicleId,
        depositStatus: true,
      })

      res.status(201).json({ success: true, data: booking })
    } catch (error) {
      next(error)
    }
  }

  async getUserBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const bookings = await bookingService.getUserBookings(userId)
      res.status(200).json({ success: true, data: bookings })
    } catch (error) {
      next(error)
    }
  }
  async getBookingsByStationId(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params
    const bookings = await bookingService.getBookingByStationId(Number.parseInt(id))

    if (!bookings || bookings.length === 0) {
      res.status(404).json({ message: "Không tìm thấy booking cho trạm này" })
      return
    }

    res.status(200).json({ success: true, data: bookings })
  } catch (error) {
    next(error)
  }
}
  async getBookingDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const booking = await bookingService.getBookingDetails(Number(id))

      if (!booking) {
        res.status(404).json({ message: "Booking not found" })
        return
      }

      res.status(200).json({ success: true, data: booking })
    } catch (error) {
      next(error)
    }
  }

  async cancelBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user?.userId

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const result = await bookingService.cancelBooking(Number(id), userId)
      res.status(200).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  async getAvailableSlots(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = req.query

      if (!stationId) {
        res.status(400).json({ message: "Station ID is required" })
        return
      }

      const slots = await bookingService.getAvailableSlots(Number(stationId))
      res.status(200).json({ success: true, data: slots })
    } catch (error) {
      next(error)
    }
  }

  async checkoutBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await bookingService.checkoutBooking(Number(id))
      res.json({ success: true, message: "Booking checked out successfully" })
    } catch (error) {
      next(error)
    }
  }
}

export const bookingController = new BookingController()
