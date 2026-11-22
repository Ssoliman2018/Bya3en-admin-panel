import { z } from 'zod';

const PathsSchema = z.object({
  auth: z.object({
    signIn: z.string().min(1),
    signUp: z.string().min(1),
    verifyMfa: z.string().min(1),
    callback: z.string().min(1),
    passwordReset: z.string().min(1),
    passwordUpdate: z.string().min(1),
  }),
  app: z.object({
    home: z.string().min(1),
    profileSettings: z.string().min(1),
    products: z.string().min(1),
    productsNew: z.string().min(1),
    product: z.string().min(1),
    banners: z.string().min(1),
    performance: z.string().min(1),
    orders: z.string().min(1),
    customers: z.string().min(1),
    merchants: z.string().min(1),
    merchant: z.string().min(1),
    affiliates: z.string().min(1),
    commissions: z.string().min(1),
    subscriptions: z.string().min(1),
    finance: z.string().min(1),
    roles: z.string().min(1),
  }),
});

const pathsConfig = PathsSchema.parse({
  auth: {
    signIn: '/auth/sign-in',
    signUp: '/auth/sign-up',
    verifyMfa: '/auth/verify',
    callback: '/auth/callback',
    passwordReset: '/auth/password-reset',
    passwordUpdate: '/update-password',
  },
  app: {
    home: '/home',
    profileSettings: '/home/settings',
    products: '/home/products',
    productsNew: '/home/products/new',
    product: '/home/products/[productId]',
    banners: '/home/banners',
    performance: '/home/performance',
    orders: '/home/orders',
    customers: '/home/customers',
    merchants: '/home/merchants',
    merchant: '/home/merchants/[merchantId]',
    affiliates: '/home/affiliates',
    commissions: '/home/commissions',
    subscriptions: '/home/subscriptions',
    finance: '/home/finance',
    roles: '/home/roles',
  },
} satisfies z.infer<typeof PathsSchema>);

export default pathsConfig;
