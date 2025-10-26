import type { AuthRequest } from "../middlewares/authMiddleware"
import type { NextFunction, Response } from "express"
import { membershipService } from "../services/membershipService"

export class MembershipController {
  // Get all packages
  async getPackages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const packages = await membershipService.getPackages()
      res.status(200).json({ success: true, data: packages })
    } catch (error) {
      next(error)
    }
  }

  // Get package by ID
  async getPackageById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const pkg = await membershipService.getPackageById(Number(id))
      if (!pkg) {
        res.status(404).json({ message: "Package not found" })
        return
      }
      res.status(200).json({ success: true, data: pkg })
    } catch (error) {
      next(error)
    }
  }

  // Create package (admin only)
  async createPackage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { packageName, packageDescrip, packagePrice } = req.body
      if (!packageName || !packagePrice) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }
      const result = await membershipService.createPackage(packageName, packageDescrip, packagePrice)
      res.status(201).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  // Update package (admin only)
  async updatePackage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { packageName, packageDescrip, packagePrice } = req.body
      if (!packageName || !packagePrice) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }
      await membershipService.updatePackage(Number(id), packageName, packageDescrip, packagePrice)
      res.json({ success: true, message: "Package updated successfully" })
    } catch (error) {
      next(error)
    }
  }

  // Delete package (admin only)
  async deletePackage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await membershipService.deletePackage(Number(id))
      res.json({ success: true, message: "Package deleted successfully" })
    } catch (error) {
      next(error)
    }
  }

  // Purchase subscription
  async purchaseSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { packageId,companyId } = req.body
      const userId = req.user?.userId
    

      if (!userId || !packageId) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const result = await membershipService.purchaseSubscription(userId, companyId, packageId)
      res.status(201).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  // Get user subscription
  async getUserSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }
      const subscription = await membershipService.getUserSubscription(userId)
      res.json({ success: true, data: subscription })
    } catch (error) {
      next(error)
    }
  }

  // Get company subscription
  async getCompanySubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const subscription = await membershipService.getCompanySubscription(Number(id))
      res.json({ success: true, data: subscription })
    } catch (error) {
      next(error)
    }
  }

  // Renew subscription
  async renewSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await membershipService.renewSubscription(Number(id))
      res.json({ success: true, message: "Subscription renewed successfully" })
    } catch (error) {
      next(error)
    }
  }

  // Cancel subscription
  async cancelSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      await membershipService.cancelSubscription(Number(id))
      res.json({ success: true, message: "Subscription cancelled successfully" })
    } catch (error) {
      next(error)
    }
  }
}

export const membershipController = new MembershipController()
