import { AuthRequest } from "@/middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/errorMiddleware";

import { stationService } from "../services/stationService";
import { NextFunction,Response } from "express";

class StationController{
      
GetStatusStation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Read StationAddress from query (GET) or body (fallback)
            const StationAddress = (req.query.StationAddress as string) ?? (req.body?.StationAddress as string)

            if (!StationAddress) {
                res.status(400).json({ message: 'Thiếu địa chỉ trạm' });
                return;
            }
            const stationStatus  = await stationService.getStationInfor(StationAddress);
            res.status(200).json({data: stationStatus, message: 'Station status fetched successfully' });
        } catch (error) {
          next(error);
        }
      })
    GetAllStations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const stations = await stationService.getAllStations();
            res.status(200).json({ data: stations, message: 'All stations fetched successfully' });
        } catch (error) {
          next(error);
        }
        })
}
export const stationController = new StationController();