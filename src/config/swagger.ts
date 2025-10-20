import swaggerJSDoc from 'swagger-jsdoc'

// OpenAPI 3.0 configuration for swagger-jsdoc
export const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'EV Charging Management System API',
      version: '1.0.0',
      description: 'API documentation for Admin and Station endpoints',
    },
    servers: [
      {
        url: '/api',
        description: 'Base API path',
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Local development server',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Admin', description: 'Admin endpoints' },
      { name: 'Station', description: 'Station endpoints' },
      { name: 'Payment', description: 'VNPay payment endpoints' },
      { name: 'Package', description: 'Package management endpoints' },
      { name: 'Subscription', description: 'Subscription management endpoints' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          description: 'Payload for loginHandler',
          type: 'object',
          required: ['Email', 'PasswordHash'],
          properties: {
            Email: { type: 'string', format: 'email', example: 'user@gmail.com' },
            PasswordHash: { type: 'string', example: 'secret123' },
          },
        },
        RegisterRequest: {
          description: 'Payload for registerHandler',
          type: 'object',
          required: ['Email', 'PasswordHash', 'ConfirmPassword'],
          properties: {
            Email: { type: 'string', format: 'email', example: 'user@gmail.com' },
            PasswordHash: { type: 'string', example: 'secret123' },
            ConfirmPassword: { type: 'string', example: 'secret123' },
            FullName: { type: 'string', example: 'Nguyen Van A' },
          },
        },
        RefreshTokenRequest: {
          description: 'Payload for refreshAccessTokenHandler',
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        ChangePasswordRequest: {
          description: 'Payload for PasswordChangeHandler',
          type: 'object',
          required: ['password', 'NewPassword', 'confirmNewPassword'],
          properties: {
            password: { type: 'string', example: 'oldpass' },
            NewPassword: { type: 'string', example: 'newpass123' },
            confirmNewPassword: { type: 'string', example: 'newpass123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Scan route files and controller files for JSDoc annotations
  apis: [
    'src/routes/*.ts',
    'src/controllers/*.ts',
  ],
}


export const swaggerSpec = swaggerJSDoc(swaggerOptions)
