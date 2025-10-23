import { AuthRequest } from '@/middlewares/authMiddleware'
import { asyncHandler, createError } from '../middlewares/errorMiddleware'
import { subscriptionService } from '../services/subscriptionService'
import { NextFunction, Response } from 'express'

class SubscriptionController {
  getAll = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const subs = await subscriptionService.getAllSubscriptions()
    res.status(200).json({ data: subs, message: 'Subscriptions fetched successfully' })
  })

  getById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid subscription id', 400, 'VALIDATION_ERROR')

    const sub = await subscriptionService.getSubscriptionById(id)
    if (!sub) throw createError('Subscription not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: sub, message: 'Subscription fetched successfully' })
  })

  create = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth } = req.body
    if (!PackageId) throw createError('PackageId is required', 400, 'VALIDATION_ERROR')
    if (!StartDate) throw createError('StartDate is required', 400, 'VALIDATION_ERROR')

    const created = await subscriptionService.createSubscription({ UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth })
    res.status(201).json({ data: created, message: 'Subscription created successfully' })
  })

  update = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid subscription id', 400, 'VALIDATION_ERROR')

    const updated = await subscriptionService.updateSubscription(id, req.body)
    if (!updated) throw createError('Subscription not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: updated, message: 'Subscription updated successfully' })
  })

  delete = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid subscription id', 400, 'VALIDATION_ERROR')

    const deleted = await subscriptionService.deleteSubscription(id)
    if (!deleted) throw createError('Subscription not found', 404, 'NOT_FOUND')

    res.status(200).json({ message: 'Subscription deleted successfully' })
  })
}

export const subscriptionController = new SubscriptionController()
