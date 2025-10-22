import { AuthRequest } from "@/middlewares/authMiddleware";
import { asyncHandler } from "../middlewares/errorMiddleware";

import { vehicleService } from "../services/vehicleService";
import { NextFunction,Response } from "express";
class VehicleController {

   addVehicle = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { companyId, vehicleName, licensePlate, battery } = req.body
    const userId = req.user?.userId

    if (!userId || !companyId || !vehicleName || !licensePlate) {
      res.status(400).json({ message: "Missing required fields" })
      return
    }

    await vehicleService.addVehicle(
      userId,
      companyId,
      vehicleName,
      licensePlate,
      battery,
    )

    res.status(201).json({ success: true, message: "Vehicle added successfully." })
  } catch (error) {
    next(error)
  }
})

}
export const vehicleController = new VehicleController();
