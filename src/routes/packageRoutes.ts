import { Router } from 'express'
import { authenticate, authorize } from '../middlewares/authMiddleware'
import { listPackages, getPackage, createPackage, updatePackage, deletePackage } from '../controllers/packageController'

const router = Router()

/**
 * @openapi
 * tags:
 *   - name: Package
 *     description: Package management endpoints
 */

/**
 * @openapi
 * /packages:
 *   get:
 *     tags: [Package]
 *     summary: Lấy toàn bộ gói dịch vụ
 *     responses:
 *       200:
 *         description: Danh sách gói cước
 */
router.get('/', listPackages)

/**
 * @openapi
 * /packages/{id}:
 *   get:
 *     tags: [Package]
 *     summary: Xem chi tiết 1 gói cụ thể
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Thông tin gói cước
 *       404:
 *         description: Không tìm thấy gói
 */
router.get('/:id', getPackage)

/**
 * @openapi
 * /packages:
 *   post:
 *     tags: [Package]
 *     summary: Admin thêm gói mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [PackageName, PackagePrice]
 *             properties:
 *               PackageName: { type: string, example: 'Gói Basic' }
 *               PackageDescrip: { type: string, example: 'Mô tả gói' }
 *               PackagePrice: { type: number, example: 99000 }
 *     responses:
 *       201:
 *         description: Tạo gói thành công
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, authorize(['ADMIN', 'Admin']), createPackage)

/**
 * @openapi
 * /packages/{id}:
 *   put:
 *     tags: [Package]
 *     summary: Admin chỉnh sửa gói
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [PackageName, PackagePrice]
 *             properties:
 *               PackageName: { type: string, example: 'Gói Pro' }
 *               PackageDescrip: { type: string, example: 'Mô tả mới' }
 *               PackagePrice: { type: number, example: 149000 }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy gói
 */
router.put('/:id', authenticate, authorize(['ADMIN', 'Admin']), updatePackage)

/**
 * @openapi
 * /packages/{id}:
 *   delete:
 *     tags: [Package]
 *     summary: Admin ngưng sử dụng gói
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       204:
 *         description: Xóa thành công
 *       404:
 *         description: Không tìm thấy gói
 */
router.delete('/:id', authenticate, authorize(['ADMIN', 'Admin']), deletePackage)

export { router as packageRoutes }
