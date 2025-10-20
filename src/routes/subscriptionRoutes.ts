import { Router } from 'express'
import { authenticate } from '../middlewares/authMiddleware'
import { createSubscription, listUserSubscriptions, renewSubscription, cancelSubscription } from '../controllers/subscriptionController'

const router = Router()

/**
 * @openapi
 * tags:
 *   - name: Subscription
 *     description: Subscription management endpoints
 */

/**
 * @openapi
 * /subscriptions:
 *   post:
 *     tags: [Subscription]
 *     summary: User chọn gói và đăng ký
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [UserId, CompanyId, PackageId]
 *             properties:
 *               UserId: { type: integer, example: 1 }
 *               CompanyId: { type: integer, example: 1 }
 *               PackageId: { type: integer, example: 2 }
 *               StartMonth: { type: string, example: '2025-10' }
 *               StartDate: { type: string, format: date, example: '2025-10-20' }
 *               DurationMonth: { type: string, example: '3' }
 *     responses:
 *       201:
 *         description: Tạo đăng ký thành công
 */
router.post('/', authenticate, createSubscription)

/**
 * @openapi
 * /subscriptions/user/{userId}:
 *   get:
 *     tags: [Subscription]
 *     summary: Xem lịch sử các gói đã mua của user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer, example: 1 }
 *     responses:
 *       200:
 *         description: Danh sách đăng ký
 */
router.get('/user/:userId', authenticate, listUserSubscriptions)

/**
 * @openapi
 * /subscriptions/{subscriptionId}/renew:
 *   put:
 *     tags: [Subscription]
 *     summary: Gia hạn thêm 1 chu kỳ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       200:
 *         description: Gia hạn thành công
 */
router.put('/:subscriptionId/renew', authenticate, renewSubscription)

/**
 * @openapi
 * /subscriptions/{subscriptionId}:
 *   delete:
 *     tags: [Subscription]
 *     summary: Hủy đăng ký
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscriptionId
 *         required: true
 *         schema: { type: integer, example: 10 }
 *     responses:
 *       204:
 *         description: Hủy thành công
 */
router.delete('/:subscriptionId', authenticate, cancelSubscription)

export { router as subscriptionRoutes }
