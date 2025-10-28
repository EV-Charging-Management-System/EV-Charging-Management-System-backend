import type { AuthRequest } from '../middlewares/authMiddleware'
import type { NextFunction, Response } from 'express'
import { asyncHandler, createError } from '../middlewares/errorMiddleware'
import { subscriptionService } from '../services/subscriptionService'

class SubscriptionController {
  getAll = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const subs = await subscriptionService.getAllSubscriptions()
    res.status(200).json({ success: true, data: subs })
  })

  getById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid subscription id', 400, 'VALIDATION_ERROR')
    const sub = await subscriptionService.getSubscriptionById(id)
    if (!sub) throw createError('Subscription not found', 404, 'NOT_FOUND')
    res.status(200).json({ success: true, data: sub })
  })

  create = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { UserId, CompanyId, PackageId, DurationMonth } = req.body
    if (!PackageId) throw createError('PackageId is required', 400, 'VALIDATION_ERROR')
    const created = await subscriptionService.createSubscription({ UserId, CompanyId, PackageId, StartDate: new Date().toISOString(), DurationMonth })
    res.status(201).json({ success: true, data: created })
  })

  update = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid subscription id', 400, 'VALIDATION_ERROR')
    const updated = await subscriptionService.updateSubscription(id, req.body)
    if (!updated) throw createError('Subscription not found', 404, 'NOT_FOUND')
    res.status(200).json({ success: true, data: updated })
  })

  delete = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid subscription id', 400, 'VALIDATION_ERROR')
    const deleted = await subscriptionService.deleteSubscription(id)
    if (!deleted) throw createError('Subscription not found', 404, 'NOT_FOUND')
    res.status(200).json({ success: true, message: 'Subscription deleted' })
  })

  // --- New APIs requested ---
  // EVDriver buys a package
  buy = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId
    const { packageId, durationMonths, companyId } = req.body
    if (!userId) throw createError('Unauthorized', 401, 'UNAUTHORIZED')
    if (!packageId) throw createError('packageId is required', 400, 'VALIDATION_ERROR')
    const created = await subscriptionService.buyForUser(Number(userId), Number(packageId), Number(durationMonths) || 1, companyId ?? null)
    res.status(201).json({ success: true, data: created })
  })

  // Business buys for company
  buyCompany = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { packageId, companyId, durationMonths, userId } = req.body
    if (!companyId || !packageId) throw createError('companyId and packageId are required', 400, 'VALIDATION_ERROR')
    const created = await subscriptionService.buyForCompany(Number(companyId), Number(packageId), Number(durationMonths) || 1, userId ?? null)
    res.status(201).json({ success: true, data: created })
  })

  // Check subscription status by userId (query param or current user)
  status = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const qUserId = req.query.userId ? Number(req.query.userId) : undefined
    const userId = qUserId ?? req.user?.userId
    if (!userId) throw createError('userId is required', 400, 'VALIDATION_ERROR')
    const status = await subscriptionService.getStatusByUserId(Number(userId))
    res.status(200).json({ success: true, data: status })
  })

  // Renew subscription: body can include subcriptionId or will target latest for current user
  renew = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { subcriptionId, addMonths } = req.body
    const add = Number(addMonths) || 1
    let updated
    if (subcriptionId) {
      updated = await subscriptionService.renewSubscriptionById(Number(subcriptionId), add)
    } else {
      const userId = req.user?.userId
      if (!userId) throw createError('userId is required for renewing latest subscription', 400, 'VALIDATION_ERROR')
      updated = await subscriptionService.renewLatestByUserId(Number(userId), add)
    }
    if (!updated) throw createError('Subscription not found to renew', 404, 'NOT_FOUND')
    res.status(200).json({ success: true, data: updated })
  })

  // Cancel subscription: body can include subcriptionId or will target latest for current user
  cancel = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { subcriptionId } = req.body
    let ok = false
    if (subcriptionId) {
      ok = await subscriptionService.cancelSubscriptionById(Number(subcriptionId))
    } else {
      const userId = req.user?.userId
      if (!userId) throw createError('userId is required for cancelling latest subscription', 400, 'VALIDATION_ERROR')
      ok = await subscriptionService.cancelLatestByUserId(Number(userId))
    }
    if (!ok) throw createError('Subscription not found or could not be cancelled', 404, 'NOT_FOUND')
    res.status(200).json({ success: true, message: 'Subscription cancelled' })
  })
}

export const subscriptionController = new SubscriptionController()

