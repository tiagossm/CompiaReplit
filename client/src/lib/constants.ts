export const USER_ROLES = {
  SYSTEM_ADMIN: "system_admin",
  ORG_ADMIN: "org_admin", 
  MANAGER: "manager",
  INSPECTOR: "inspector",
  CLIENT: "client"
} as const;

export const ORGANIZATION_TYPES = {
  MASTER: "master",
  ENTERPRISE: "enterprise",
  SUBSIDIARY: "subsidiary"
} as const;

export const INSPECTION_STATUS = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  APPROVED: "approved",
  REJECTED: "rejected"
} as const;

export const ACTION_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  OVERDUE: "overdue",
  CANCELLED: "cancelled"
} as const;

export const PRIORITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical"
} as const;

export const SUBSCRIPTION_PLANS = {
  BASIC: "basic",
  PRO: "pro",
  ENTERPRISE: "enterprise"
} as const;

export const ROLE_LABELS = {
  [USER_ROLES.SYSTEM_ADMIN]: "Administrador do Sistema",
  [USER_ROLES.ORG_ADMIN]: "Administrador da Organização",
  [USER_ROLES.MANAGER]: "Gerente",
  [USER_ROLES.INSPECTOR]: "Técnico/Inspetor",
  [USER_ROLES.CLIENT]: "Cliente"
} as const;

export const STATUS_LABELS = {
  [INSPECTION_STATUS.DRAFT]: "Rascunho",
  [INSPECTION_STATUS.IN_PROGRESS]: "Em Andamento",
  [INSPECTION_STATUS.COMPLETED]: "Concluída",
  [INSPECTION_STATUS.APPROVED]: "Aprovada",
  [INSPECTION_STATUS.REJECTED]: "Rejeitada"
} as const;

export const ACTION_STATUS_LABELS = {
  [ACTION_STATUS.PENDING]: "Pendente",
  [ACTION_STATUS.IN_PROGRESS]: "Em Andamento",
  [ACTION_STATUS.COMPLETED]: "Concluída",
  [ACTION_STATUS.OVERDUE]: "Atrasada",
  [ACTION_STATUS.CANCELLED]: "Cancelada"
} as const;

export const PRIORITY_LABELS = {
  [PRIORITY_LEVELS.LOW]: "Baixa",
  [PRIORITY_LEVELS.MEDIUM]: "Média",
  [PRIORITY_LEVELS.HIGH]: "Alta",
  [PRIORITY_LEVELS.CRITICAL]: "Crítica"
} as const;

export const STATUS_COLORS = {
  [INSPECTION_STATUS.DRAFT]: "bg-gray-100 text-gray-800",
  [INSPECTION_STATUS.IN_PROGRESS]: "bg-yellow-100 text-yellow-800",
  [INSPECTION_STATUS.COMPLETED]: "bg-green-100 text-green-800",
  [INSPECTION_STATUS.APPROVED]: "bg-blue-100 text-blue-800",
  [INSPECTION_STATUS.REJECTED]: "bg-red-100 text-red-800"
} as const;

export const ACTION_STATUS_COLORS = {
  [ACTION_STATUS.PENDING]: "bg-gray-100 text-gray-800",
  [ACTION_STATUS.IN_PROGRESS]: "bg-yellow-100 text-yellow-800",
  [ACTION_STATUS.COMPLETED]: "bg-green-100 text-green-800",
  [ACTION_STATUS.OVERDUE]: "bg-red-100 text-red-800",
  [ACTION_STATUS.CANCELLED]: "bg-gray-100 text-gray-800"
} as const;

export const PRIORITY_COLORS = {
  [PRIORITY_LEVELS.LOW]: "bg-green-100 text-green-800",
  [PRIORITY_LEVELS.MEDIUM]: "bg-yellow-100 text-yellow-800",
  [PRIORITY_LEVELS.HIGH]: "bg-orange-100 text-orange-800",
  [PRIORITY_LEVELS.CRITICAL]: "bg-red-100 text-red-800"
} as const;
