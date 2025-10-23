import { AuthRequest } from '@/middlewares/authMiddleware'
import { asyncHandler, createError } from '../middlewares/errorMiddleware'
import { companyService } from '../services/companyService'
import { NextFunction, Response } from 'express'

class CompanyController {
  getAll = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const companies = await companyService.getAllCompanies()
    res.status(200).json({ data: companies, message: 'Companies fetched successfully' })
  })

  getById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid company id', 400, 'VALIDATION_ERROR')

    const company = await companyService.getCompanyById(id)
    if (!company) throw createError('Company not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: company, message: 'Company fetched successfully' })
  })

  create = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const { CompanyName, Address, Mail, Phone } = req.body
    if (!CompanyName) throw createError('CompanyName is required', 400, 'VALIDATION_ERROR')

    const created = await companyService.createCompany({ CompanyName, Address, Mail, Phone })
    res.status(201).json({ data: created, message: 'Company created successfully' })
  })

  update = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid company id', 400, 'VALIDATION_ERROR')

    const updated = await companyService.updateCompany(id, req.body)
    if (!updated) throw createError('Company not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: updated, message: 'Company updated successfully' })
  })

  delete = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid company id', 400, 'VALIDATION_ERROR')

    const deleted = await companyService.deleteCompany(id)
    if (!deleted) throw createError('Company not found', 404, 'NOT_FOUND')

    res.status(200).json({ message: 'Company deleted successfully' })
  })
}

export const companyController = new CompanyController()
