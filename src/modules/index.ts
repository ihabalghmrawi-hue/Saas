/**
 * Module Registry
 *
 * Maps each business type to its module config.
 * Used to dynamically load nav, KPIs, shortcuts, and account mappings.
 */

import type { BusinessType } from '@/lib/features'
import { constructionModule } from './construction/config'
import { pharmacyModule }     from './pharmacy/config'

export type ModuleConfig = typeof constructionModule

export const MODULE_REGISTRY: Partial<Record<BusinessType, ModuleConfig>> = {
  construction: constructionModule,
  pharmacy:     pharmacyModule as any,
}

export function getModuleConfig(businessType: BusinessType): ModuleConfig | null {
  return MODULE_REGISTRY[businessType] ?? null
}

export function getModuleNav(businessType: BusinessType) {
  return MODULE_REGISTRY[businessType]?.navItems ?? []
}

export function getModuleDashboardKPIs(businessType: BusinessType) {
  return MODULE_REGISTRY[businessType]?.dashboardKPIs ?? []
}

export function getModuleShortcuts(businessType: BusinessType) {
  return MODULE_REGISTRY[businessType]?.shortcuts ?? []
}

export function getModuleAccountMappings(businessType: BusinessType) {
  return (MODULE_REGISTRY[businessType] as any)?.accountMappings ?? {}
}
