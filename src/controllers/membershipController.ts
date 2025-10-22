import type { AuthRequest } from "@/middlewares/authMiddleware"
import { asyncHandler } from "../middlewares/errorMiddleware"
import { membershipService } from "../services/membershipService"
import type { NextFunction, Response } from "express"

class MembershipController {
  // Get membership packages
  getMembershipPackages = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const packages = await membershipService.getMembershipPackages()
      res.status(200).json({ data: packages, message: "Membership packages fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Purchase membership
  purchaseMembership = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { packageId, paymentMethod } = req.body
      const userId = req.user?.userId

      if (!userId || !packageId || !paymentMethod) {
        res.status(400).json({ message: "Missing required fields" })
        return
      }

      const membership = await membershipService.purchaseMembership(userId, packageId, paymentMethod)
      res.status(201).json({ data: membership, message: "Membership purchased successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Get user membership
  getUserMembership = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const membership = await membershipService.getUserMembership(userId)
      res.status(200).json({ data: membership, message: "User membership fetched successfully" })
    } catch (error) {
      next(error)
    }
  })

  // Check membership validity
  checkMembershipValidity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" })
        return
      }

      const isValid = await membershipService.checkMembershipValidity(userId)
      res.status(200).json({ data: { isValid }, message: "Membership validity checked" })
    } catch (error) {
      next(error)
    }
  })
}

export const membershipController = new MembershipController()
