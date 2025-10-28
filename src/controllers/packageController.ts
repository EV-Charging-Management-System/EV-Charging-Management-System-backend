import { AuthRequest } from '@/middlewares/authMiddleware'
import { asyncHandler, createError } from '../middlewares/errorMiddleware'
import { packageService } from '../services/packageService'
import { NextFunction, Response } from 'express'

class PackageController {
  getAll = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const packages = await packageService.getAllPackages()
    res.status(200).json({ data: packages, message: 'Packages fetched successfully' })
  })

  getById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid package id', 400, 'VALIDATION_ERROR')

    const pkg = await packageService.getPackageById(id)
    if (!pkg) throw createError('Package not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: pkg, message: 'Package fetched successfully' })
  })

  create = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { PackageName, PackageDescrip, PackagePrice } = req.body
    if (!PackageName) throw createError('PackageName is required', 400, 'VALIDATION_ERROR')

    const created = await packageService.createPackage({ PackageName, PackageDescrip, PackagePrice })
    res.status(201).json({ data: created, message: 'Package created successfully' })
  })

  update = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid package id', 400, 'VALIDATION_ERROR')

    const updated = await packageService.updatePackage(id, req.body)
    if (!updated) throw createError('Package not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: updated, message: 'Package updated successfully' })
  })

  delete = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid package id', 400, 'VALIDATION_ERROR')

    const deleted = await packageService.deletePackage(id)
    if (!deleted) throw createError('Package not found', 404, 'NOT_FOUND')

    res.status(200).json({ message: 'Package deleted successfully' })
  })
}

export const packageController = new PackageController()
