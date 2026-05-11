export const pharmacyModule = {
  id:           'pharmacy',
  businessType: ['pharmacy'] as string[],
  label:        'الصيدلية',
  icon:         '💊',

  navItems: [
    { href: '/dashboard',            label: 'الرئيسية',    icon: 'LayoutDashboard' },
    { href: '/dashboard/pos',        label: 'نقطة البيع',  icon: 'ShoppingCart'   },
    { href: '/dashboard/sales',      label: 'المبيعات',   icon: 'Receipt'         },
    { href: '/dashboard/purchases',  label: 'المشتريات',  icon: 'ShoppingBag'    },
    { href: '/dashboard/inventory',  label: 'المخزون',    icon: 'Package'        },
    { href: '/dashboard/expenses',   label: 'المصروفات',  icon: 'Banknote'       },
    { href: '/dashboard/customers',  label: 'العملاء',    icon: 'Users'          },
    { href: '/dashboard/suppliers',  label: 'الموردون',   icon: 'Truck'          },
    { href: '/dashboard/reports',    label: 'التقارير',   icon: 'BarChart2'      },
  ],

  dashboardKPIs: [
    { key: 'sales_today',      label: 'مبيعات اليوم',      icon: 'TrendingUp', color: 'green'  },
    { key: 'low_stock',        label: 'مخزون منخفض',       icon: 'AlertTriangle',color: 'red'  },
    { key: 'expiring_30',      label: 'تنتهي خلال 30 يوم', icon: 'Clock',      color: 'yellow' },
    { key: 'monthly_revenue',  label: 'إيرادات الشهر',     icon: 'Wallet',     color: 'blue'   },
  ],

  shortcuts: [
    { href: '/dashboard/pos',              label: 'نقطة البيع',    icon: 'ShoppingCart' },
    { href: '/dashboard/purchases?new=1',  label: 'فاتورة شراء',  icon: 'Plus'         },
    { href: '/dashboard/inventory',        label: 'تنبيه الصلاحية', icon: 'AlertCircle' },
    { href: '/dashboard/reports',          label: 'التقارير',      icon: 'BarChart2'    },
  ],

  productAttributes: {
    dosage_form:     ['قرص', 'كبسول', 'شراب', 'حقنة', 'كريم', 'قطرة', 'تحميلة'],
    storage_type:    ['غرفة', 'ثلاجة', 'تجميد'],
    prescription:    ['بوصفة طبية', 'بدون وصفة'],
  },

  accountMappings: {
    revenue:      '4001',
    cogs:         '5001',
    cash:         '1110',
    ar:           '1120',
    inventory:    '1130',
  },
}
