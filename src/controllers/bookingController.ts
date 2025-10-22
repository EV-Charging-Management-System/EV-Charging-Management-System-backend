import type { AuthRequest } from "@/middlewares/authMiddleware"
import { asyncHandler } from "../middlewares/errorMiddleware"
import { bookingService } from "../services/bookingService"
import type { NextFunction, Response } from "express"

class BookingController {
  // Create a new booking
  createBooking = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { stationId, vehicleId, qr } = req.body
    const userId = req.user?.userId

    if (!userId || !stationId || !vehicleId) {
      res.status(400).json({ message: "Missing required fields" })
      return
    }

    const booking = await bookingService.createBooking({
      userId,
      stationId,
      vehicleId,
      qr,
      depositStatus: false
    })

    res.status(201).json({ data: booking, message: "Booking created successfully" })
  } catch (error) {
    next(error)
  }
})


  // Get user bookings
  getUserBookings = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const bookings = await bookingService.getUserBookings(userId)
      res.status(200).json({ data: bookings, message: "User bookings fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Get booking details
  getBookingDetails = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookingId } = req.params
      const booking = await bookingService.getBookingDetails(bookingId)

      if (!booking) {
        res.status(404).json({ message: "Booking not found" })
        return
      }

      res.status(200).json({ data: booking, message: "Booking details fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Cancel booking
  cancelBooking = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookingId } = req.params
      const userId = req.user?.userId

      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const result = await bookingService.cancelBooking(Number.parseInt(bookingId), userId)
      res.status(200).json({ data: result, message: "Booking cancelled successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Get available slots
  getAvailableSlots = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { stationId } = req.query

      if (!stationId ) {
        res.status(400).json({ message: "Missing stationId or date" })
        return
      }

      const slots = await bookingService.getAvailableSlots(stationId as string)
      res.status(200).json({ data: slots, message: "Available slots fetched successfully" })
    } catch (error) {
      next(error)
    }
  })
}

export const bookingController = new BookingController()
