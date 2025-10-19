import type { Request, Response, RequestHandler } from 'express'
import { packageService } from '../services/packageService'

export const listPackages: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await packageService.getAll()
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const getPackage: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Invalid id' })
      return
    }
    const item = await packageService.getById(id)
    if (!item) {
      res.status(404).json({ message: 'Package not found' })
      return
    }
    res.json({ success: true, data: item })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const createPackage: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { PackageName, PackageDescrip, PackagePrice } = req.body as {
      PackageName?: string
      PackageDescrip?: string | null
      PackagePrice?: number
    }
    if (!PackageName || typeof PackageName !== 'string') {
      res.status(400).json({ message: 'PackageName is required' })
      return
    }
    if (PackagePrice == null || !Number.isFinite(PackagePrice) || PackagePrice < 0) {
      res.status(400).json({ message: 'PackagePrice must be a non-negative number' })
      return
    }
    const created = await packageService.create({ PackageName, PackageDescrip: PackageDescrip ?? null, PackagePrice })
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const updatePackage: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Invalid id' })
      return
    }
    const { PackageName, PackageDescrip, PackagePrice } = req.body as {
      PackageName?: string
      PackageDescrip?: string | null
      PackagePrice?: number
    }
    if (!PackageName || typeof PackageName !== 'string') {
      res.status(400).json({ message: 'PackageName is required' })
      return
    }
    if (PackagePrice == null || !Number.isFinite(PackagePrice) || PackagePrice < 0) {
      res.status(400).json({ message: 'PackagePrice must be a non-negative number' })
      return
    }
    const updated = await packageService.update({ PackageId: id, PackageName, PackageDescrip: PackageDescrip ?? null, PackagePrice })
    if (!updated) {
      res.status(404).json({ message: 'Package not found' })
      return
    }
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}

export const deletePackage: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: 'Invalid id' })
      return
    }
    const ok = await packageService.remove(id)
    if (!ok) {
      res.status(404).json({ message: 'Package not found' })
      return
    }
    res.status(204).send()
  } catch (e) {
    res.status(500).json({ message: (e as Error).message })
  }
}
