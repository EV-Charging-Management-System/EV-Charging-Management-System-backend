import { AuthRequest } from '@/middlewares/authMiddleware'
import { asyncHandler, createError } from '../middlewares/errorMiddleware'
import { userService } from '../services/userService'
import { NextFunction, Response } from 'express'

class UserController {
  getAll = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const users = await userService.getAllUsers()
    res.status(200).json({ data: users, message: 'Users fetched successfully' })
  })

  getById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid user id', 400, 'VALIDATION_ERROR')

    const user = await userService.getUserById(id)
    if (!user) throw createError('User not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: user, message: 'User fetched successfully' })
  })

  update = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid user id', 400, 'VALIDATION_ERROR')

    // Authorization: allow owner or ADMIN/STAFF
    const requester = req.user
    if (!requester) throw createError('Unauthorized', 401, 'UNAUTHORIZED')

    const rolesAllowed = ['ADMIN', 'STAFF']
    if (requester.userId !== id && !rolesAllowed.includes(requester.role)) {
      throw createError('Forbidden', 403, 'FORBIDDEN')
    }

    const updated = await userService.updateUser(id, req.body)
    if (!updated) throw createError('User not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: updated, message: 'User updated successfully' })
  })

  delete = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid user id', 400, 'VALIDATION_ERROR')

    const requester = req.user
    if (!requester) throw createError('Unauthorized', 401, 'UNAUTHORIZED')

    // Only ADMIN can delete
    if (requester.role !== 'ADMIN') {
      throw createError('Forbidden', 403, 'FORBIDDEN')
    }

    const deleted = await userService.deleteUser(id)
    if (!deleted) throw createError('User not found', 404, 'NOT_FOUND')

    res.status(200).json({ message: 'User deleted successfully' })
  })

  approve = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const id = Number(req.params.id)
    if (Number.isNaN(id)) throw createError('Invalid user id', 400, 'VALIDATION_ERROR')

    const requester = req.user
    if (!requester) throw createError('Unauthorized', 401, 'UNAUTHORIZED')

    if (requester.role !== 'ADMIN') {
      throw createError('Forbidden', 403, 'FORBIDDEN')
    }

    const approved = await userService.approveUser(id)
    if (!approved) throw createError('User not found', 404, 'NOT_FOUND')

    res.status(200).json({ data: approved, message: 'User approved successfully' })
  })
}

export const userController = new UserController()
