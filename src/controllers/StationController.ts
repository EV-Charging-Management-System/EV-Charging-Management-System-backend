import type { AuthRequest } from "../middlewares/authMiddleware"
import { asyncHandler } from "../middlewares/errorMiddleware"
import { stationService } from "../services/stationService"
import type { NextFunction, Response } from "express"

class StationController {
  GetStatusStation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { StationAddress } = req.body

      if (!StationAddress) {
        res.status(400).json({ message: "Thiếu địa chỉ trạm" })
        return
      }
      const stationStatus = await stationService.getStationInfor(StationAddress)
      res.status(200).json({ data: stationStatus, message: "Station status fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  GetAllStations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stations = await stationService.getAllStations()
      res.status(200).json({ data: stations, message: "All stations fetched successfully" })
    } catch (error) {
      next(error)
    }
  })
  GetPoint = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { stationId } = req.query

    if (!stationId) {
      res.status(400).json({ message: "Missing stationId" })
      return
    }

    const points = await stationService.getPointsByStation(Number(stationId))
    res.status(200).json({ data: points, message: "Fetched points by station successfully" })
  } catch (error) {
    next(error)
  }
})
  GetPort = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { pointId } = req.query
    if (!pointId) {
      res.status(400).json({ message: "Missing pointId" })
      return
    }

    const port = await stationService.getPortByPoint(Number(pointId))
    res.status(200).json({ data: port, message: "Fetched port by point successfully" })
  } catch (error) {
    next(error)
  }
})
  
}
export const stationController = new StationController()
