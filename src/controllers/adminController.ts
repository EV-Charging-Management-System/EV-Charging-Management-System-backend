import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { adminService } from "../services/adminService"

export class AdminController {
  async getDashboardStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats()
      res.status(200).json({ success: true, data: stats })
    } catch (error) {
      next(error)
    }
  }

  async getPendingApprovals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const approvals = await adminService.getPendingBusinessApprovals()
      res.status(200).json({ success: true, data: approvals })
    } catch (error) {
      next(error)
    }
  }

  async approveBusiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await adminService.approveBusiness(Number(id))
      res.json({ success: true, message: "Business approved successfully" })
    } catch (error) {
      next(error)
    }
  }

  async rejectBusiness(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await adminService.rejectBusiness(Number(id))
      res.json({ success: true, message: "Business rejected successfully" })
    } catch (error) {
      next(error)
    }
  }

  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await adminService.getAllUsers()
      res.status(200).json({ success: true, data: users })
    } catch (error) {
      next(error)
    }
  }

  async getUserById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const user = await adminService.getUserById(Number(id))
      if (!user) {
        res.status(404).json({ message: "User not found" })
        return
      }
      res.status(200).json({ success: true, data: user })
    } catch (error) {
      next(error)
    }
  }

  async updateUserRole(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { role } = req.body

      if (!role) {
        res.status(400).json({ message: "Role is required" })
        return
      }

      await adminService.updateUserRole(Number(id), role)
      res.json({ success: true, message: "User role updated successfully" })
    } catch (error) {
      next(error)
    }
  }

  async getRevenueReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { monthYear } = req.query
      const report = await adminService.getRevenueReport(monthYear as string)
      res.status(200).json({ success: true, data: report })
    } catch (error) {
      next(error)
    }
  }

  async getUsageReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { monthYear } = req.query
      const report = await adminService.getUsageReport(monthYear as string)
      res.status(200).json({ success: true, data: report })
    } catch (error) {
      next(error)
    }
  }
  async createStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { Email, PasswordHash, FullName } = req.body  
      if (!Email || !PasswordHash || !FullName) {
        res.status(400).json({ message: "All fields are required" })
        return
      }
      const newStaff = await adminService.createStaff( Email,  FullName ,PasswordHash)
      res.status(201).json({ success: true, data: newStaff, message: "Staff created successfully" })
    } catch (error) {
      next(error)
    }
  }
  async getAllStaff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staffList = await adminService.getAllStaff()
      res.status(200).json({ success: true, data: staffList })
    } catch (error) {
      next(error)
    }
  }
  async deleteStationById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId } = req.body
      if (!stationId) {
        res.status(400).json({ message: "stationId is required" })
        return
      }
      await adminService.deleteStationById(stationId)
      res.json({ success: true, message: "Station deleted successfully" })
    } catch (error) {
      next(error)
    }
  }
  async createPoint(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { stationId, pointName } = req.body
      if (!stationId || !pointName) {
        res.status(400).json({ message: "stationId and pointName are required" })
        return
      }
      const newPoint = await adminService.createPoint(stationId, pointName)
      res.status(201).json({ success: true, data: newPoint, message: "Point created successfully" })
    } catch (error) {
      next(error)
    }
  }
}
export const adminController = new AdminController()
