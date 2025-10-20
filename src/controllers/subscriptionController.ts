import type { Request, Response, RequestHandler } from 'express'
import { subscriptionService } from '../services/subscriptionService'

export const createSubscription: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { UserId, CompanyId, PackageId, StartMonth, StartDate, DurationMonth } = req.body as {
      UserId?: number
      CompanyId?: number
      PackageId?: number
      StartMonth?: string
      StartDate?: string
      DurationMonth?: string
    }
    if (!UserId || !CompanyId || !PackageId) {
      res.status(400).json({ message: 'UserId, CompanyId, PackageId are required' })
      return
    }
    const startDate = StartDate ? new Date(StartDate) : undefined
    const item = await subscriptionService.create({
      UserId,
      CompanyId,
      PackageId,
      StartMonth: StartMonth ?? null,
      StartDate: startDate,
      DurationMonth: DurationMonth ?? undefined,
    })
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const listUserSubscriptions: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.userId)
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ message: 'Invalid userId' })
      return
    }
    const data = await subscriptionService.listByUser(userId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const renewSubscription: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriptionId = Number(req.params.subscriptionId)
    if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
      res.status(400).json({ message: 'Invalid subscriptionId' })
      return
    }
    const updated = await subscriptionService.renew(subscriptionId)
    if (!updated) {
      res.status(404).json({ message: 'Subscription not found' })
      return
    }
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const cancelSubscription: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriptionId = Number(req.params.subscriptionId)
    if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
      res.status(400).json({ message: 'Invalid subscriptionId' })
      return
    }
    const ok = await subscriptionService.cancel(subscriptionId)
    if (!ok) {
      res.status(404).json({ message: 'Subscription not found' })
      return
    }
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}
