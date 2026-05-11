export const constructionModule = {
  id:           'construction',
  businessType: ['construction'] as string[],
  label:        'البناء والتشطيبات',
  icon:         '🏗️',

  navItems: [
    { href: '/dashboard/construction',          label: 'لوحة البناء',  icon: 'LayoutDashboard' },
    { href: '/dashboard/construction/projects', label: 'المشاريع',     icon: 'FolderKanban' },
    { href: '/dashboard/construction/tasks',    label: 'المهام',       icon: 'CheckSquare' },
    { href: '/dashboard/construction/workers',  label: 'العمال',       icon: 'HardHat' },
    { href: '/dashboard/construction/expenses', label: 'المصروفات',    icon: 'Banknote' },
    { href: '/dashboard/construction/materials',label: 'المواد',       icon: 'PackageOpen' },
    { href: '/dashboard/construction/payments', label: 'المدفوعات',    icon: 'CreditCard' },
    { href: '/dashboard/construction/reports',  label: 'تقارير البناء',icon: 'BarChart2' },
  ],

  permissions: [
    'construction:read',
    'construction:write',
    'construction:manage',
  ] as string[],

  dashboardKPIs: [
    { key: 'active_projects',      label: 'مشاريع نشطة',        icon: 'FolderOpen',  color: 'blue'   },
    { key: 'total_budget',         label: 'إجمالي الميزانيات',   icon: 'Wallet',      color: 'green'  },
    { key: 'total_expenses_month', label: 'مصروفات هذا الشهر',   icon: 'TrendingDown',color: 'red'    },
    { key: 'pending_tasks',        label: 'مهام معلقة',           icon: 'Clock',       color: 'yellow' },
  ],

  dashboardCharts: [
    { key: 'budget_vs_actual',    label: 'الميزانية مقابل الفعلي' },
    { key: 'expenses_by_category',label: 'المصروفات حسب الفئة'   },
    { key: 'project_progress',    label: 'تقدم المشاريع'          },
  ],

  shortcuts: [
    { href: '/dashboard/construction/projects?new=1', label: 'مشروع جديد',    icon: 'Plus'       },
    { href: '/dashboard/construction/expenses?new=1', label: 'تسجيل مصروف',   icon: 'Receipt'    },
    { href: '/dashboard/construction/workers?new=1',  label: 'إضافة عامل',    icon: 'UserPlus'   },
    { href: '/dashboard/construction/reports',        label: 'التقارير',      icon: 'BarChart2'  },
  ],

  // COA account codes used for auto-posting
  accountMappings: {
    expense_labor:    '6009',
    expense_materials:'6010',
    expense_default:  '6008',
    revenue:          '4002',
    cash:             '1110',
  },
}
