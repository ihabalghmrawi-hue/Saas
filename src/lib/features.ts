export type BusinessType =
  | 'pharmacy'
  | 'retail'
  | 'wholesale'
  | 'clothing'
  | 'stationery'
  | 'tools'
  | 'dress_rental'
  | 'other'

export interface Features {
  businessType: BusinessType
  // Product fields
  hasExpiry: boolean
  hasBatch: boolean
  hasVariants: boolean
  // Pricing
  hasBulkPricing: boolean
  hasMinQty: boolean
  hasWholesalePrice: boolean
  // POS behavior
  fastPOS: boolean
  barcodeFirst: boolean
  // Modules
  showReturns: boolean
  showShifts: boolean
  showPurchases: boolean
  showPOS: boolean
  showInventory: boolean
  // Rental module
  hasRental: boolean
  // Categories
  medicineCategories: boolean
  // Labels
  label: string
  icon: string
}

const FEATURE_MAP: Record<BusinessType, Omit<Features, 'businessType'>> = {
  pharmacy: {
    hasExpiry: true, hasBatch: true, hasVariants: false,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: false,
    fastPOS: false, barcodeFirst: true,
    showReturns: true, showShifts: true, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: true,
    label: 'صيدلية', icon: '💊',
  },
  retail: {
    hasExpiry: false, hasBatch: false, hasVariants: false,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: false,
    fastPOS: true, barcodeFirst: true,
    showReturns: true, showShifts: true, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: false,
    label: 'بقالة / سوبرماركت', icon: '🛒',
  },
  wholesale: {
    hasExpiry: false, hasBatch: false, hasVariants: false,
    hasBulkPricing: true, hasMinQty: true, hasWholesalePrice: true,
    fastPOS: false, barcodeFirst: true,
    showReturns: true, showShifts: false, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: false,
    label: 'بيع بالجملة', icon: '📦',
  },
  clothing: {
    hasExpiry: false, hasBatch: false, hasVariants: true,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: false,
    fastPOS: false, barcodeFirst: false,
    showReturns: true, showShifts: true, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: false,
    label: 'ملابس', icon: '👗',
  },
  stationery: {
    hasExpiry: false, hasBatch: false, hasVariants: false,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: false,
    fastPOS: true, barcodeFirst: true,
    showReturns: false, showShifts: true, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: false,
    label: 'قرطاسية', icon: '📝',
  },
  tools: {
    hasExpiry: false, hasBatch: false, hasVariants: false,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: false,
    fastPOS: false, barcodeFirst: true,
    showReturns: true, showShifts: false, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: false,
    label: 'أدوات منزلية', icon: '🔧',
  },
  dress_rental: {
    hasExpiry: false, hasBatch: false, hasVariants: false,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: false,
    fastPOS: false, barcodeFirst: false,
    showReturns: false, showShifts: false, showPurchases: false, showPOS: false, showInventory: false,
    hasRental: true, medicineCategories: false,
    label: 'تأجير فساتين', icon: '👰',
  },
  other: {
    hasExpiry: false, hasBatch: false, hasVariants: false,
    hasBulkPricing: false, hasMinQty: false, hasWholesalePrice: true,
    fastPOS: false, barcodeFirst: false,
    showReturns: true, showShifts: true, showPurchases: true, showPOS: true, showInventory: true,
    hasRental: false, medicineCategories: false,
    label: 'أخرى', icon: '🏪',
  },
}

export const BUSINESS_TYPES: BusinessType[] = [
  'pharmacy', 'retail', 'wholesale', 'clothing', 'stationery', 'tools', 'dress_rental', 'other',
]

export function getFeatures(businessType?: string | null): Features {
  const type = (businessType as BusinessType) || 'retail'
  return { businessType: type, ...FEATURE_MAP[type] ?? FEATURE_MAP.retail }
}

export const BUSINESS_TYPE_COOKIE = 'erp_business_type'
