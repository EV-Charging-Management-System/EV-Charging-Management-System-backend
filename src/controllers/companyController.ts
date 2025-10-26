import type { Response } from "express"
import type { AuthRequest } from "../middlewares/authMiddleware"
import { companyService } from "../services/companyService"

export const getCompanies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const companies = await companyService.getCompanies()
    res.json({ success: true, data: companies })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: "An unknown error occurred" })
    }
  }
}

export const getCompanyById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const company = await companyService.getCompanyById(Number(id))
    if (!company) {
      res.status(404).json({ message: "Company not found" })
      return
    }
    res.json({ success: true, data: company })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: "An unknown error occurred" })
    }
  }
}

export const getCompanyVehicles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const vehicles = await companyService.getCompanyVehicles(Number(id))
    res.json({ success: true, data: vehicles })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: "An unknown error occurred" })
    }
  }
}

export const addVehicleToCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { vehicleName, vehicleType, licensePlate, battery } = req.body

    if (!vehicleName || !vehicleType || !licensePlate || battery === undefined) {
      res.status(400).json({ message: "Missing required fields" })
      return
    }

    const result = await companyService.addVehicleToCompany(Number(id), vehicleName, vehicleType, licensePlate, battery)
    res.status(201).json({ success: true, data: result })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: "An unknown error occurred" })
    }
  }
}

export const removeVehicleFromCompany = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, vehicleId } = req.params
    await companyService.removeVehicleFromCompany(Number(vehicleId))
    res.json({ success: true, message: "Vehicle removed successfully" })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: "An unknown error occurred" })
    }
  }
}

export const getCompanyHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const history = await companyService.getCompanyHistory(Number(id))
    res.json({ success: true, data: history })
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: error.message })
    } else {
      res.status(500).json({ message: "An unknown error occurred" })
    }
  }
}
