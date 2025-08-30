// ERP Nexus - API Hooks Index
// Exports organizados de todos os hooks de API

// ====================================
// AUTH HOOKS
// ====================================
export * from './use-auth';

// ====================================
// PROFILE HOOKS
// ====================================
export * from './use-profile';

// ====================================
// CRM HOOKS
// ====================================
export * from './use-customers';

// ====================================
// SERVICES HOOKS
// ====================================
export {
  useServices,
  useService,
  useActiveServices,
  useServiceSearch,
  useServiceCategories,
  useProfessionals,
  useProfessional,
  useActiveProfessionals,
  useProfessionalAvailability as useServiceProfessionalAvailability,
  useProfessionalStatistics,
  useProfessionalServices,
  useCompletedAppointments,
  useCompletedAppointment,
  useAppointmentPhotos,
  useDailyReport,
  useProfessionalReport,
  useFinancialReport,
  useCreateService,
  useUpdateService,
  useDeleteService,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  useUpdateProfessionalSchedule,
  useAddServiceToProfessional,
  useRemoveServiceFromProfessional,
  useCreateCompletedAppointment,
  useUpdateCompletedAppointment,
  useUploadAppointmentPhotos,
  useDeleteAppointmentPhoto,
  useServicesWithFilters,
  useProfessionalsWithFilters,
  useProfessionalComplete,
  useCompletedAppointmentsWithFilters,
} from './use-services';

// ====================================
// AGENDAMENTO HOOKS
// ====================================
export {
  useAppointments,
  useAppointment,
  useTodayAppointments as useAgendamentoTodayAppointments,
  useUpcomingAppointments,
  useAppointmentsByStatus,
  useCustomerAppointments as useAgendamentoCustomerAppointments,
  useProfessionalAppointments,
  useCalendarEvents,
  useProfessionalAvailability as useAgendamentoProfessionalAvailability,
  useMultipleProfessionalsAvailability,
  useScheduleBlocks,
  useProfessionalScheduleBlocks,
  useNotifications,
  useNotificationTemplates,
  useNotificationStats,
  useWaitingList,
  useWaitingListByService,
  useWaitingListStats,
  useCreateAppointment,
  useUpdateAppointment,
  useDeleteAppointment,
  useConfirmAppointment,
  useStartAppointment,
  useCompleteAppointment,
  useCancelAppointment,
  useMarkNoShow,
  useCreateScheduleBlock,
  useUpdateScheduleBlock,
  useDeleteScheduleBlock,
  useSendNotification,
  useSendTestNotification,
  useResendNotification,
  useCreateNotificationTemplate,
  useUpdateNotificationTemplate,
  useDeleteNotificationTemplate,
  useAddToWaitingList,
  useUpdateWaitingListItem,
  useRemoveFromWaitingList,
  useContactWaitingListItem,
  useScheduleFromWaitingList,
  useAppointmentsWithFilters,
  useWaitingListWithFilters,
  useCalendarComplete,
} from './use-appointments';

// ====================================
// DASHBOARD HOOKS
// ====================================
export {
  useDashboardStats,
  useTodayAppointments,
  useRecentCustomers,
  useAlerts,
  useDashboardRefresh,
} from './use-dashboard';

// ====================================
// HEALTH CHECK HOOKS
// ====================================
export { useHealthCheck } from './use-health';

// Re-export types for convenience
export type {
  // CRM Types
  Customer,
  CustomerFilters,
  CustomerNote,
  CustomerInteraction,
  CustomerTag,
  CustomerStats,
} from './use-customers';

export type {
  // Services Types
  Service,
  ServiceCategory,
  Professional,
  CompletedAppointment,
  ServicePhoto,
  ProfessionalAvailability as ServiceProfessionalAvailability,
  ProfessionalStatistics,
  ServiceFilters,
  ProfessionalFilters,
  CompletedAppointmentFilters,
} from './use-services';

export type {
  // Agendamento Types
  Appointment,
  CalendarEvent,
  TimeSlot,
  ProfessionalAvailability,
  ScheduleBlock,
  NotificationTemplate,
  NotificationLog,
  WaitingListItem,
  AppointmentFilters,
  WaitingListFilters,
  NotificationFilters,
} from './use-appointments';

// ====================================
// SHARED TYPES
// ====================================
export type {
  PaginatedResponse,
} from './use-customers';