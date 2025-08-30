interface PeriodFilter {
    startDate: Date;
    endDate: Date;
}
interface KPIData {
    value: number;
    previousValue: number;
    change: number;
    changePercent: string;
    trend: 'up' | 'down' | 'neutral';
}
interface CRMAnalytics {
    totalCustomers: KPIData;
    activeCustomers: KPIData;
    newCustomersThisMonth: KPIData;
    averageInteractions: KPIData;
    conversionRate: number;
    customersBySource: Array<{
        source: string;
        count: number;
        percentage: number;
    }>;
    interactionsByType: Array<{
        type: string;
        count: number;
        percentage: number;
    }>;
    customerGrowthChart: Array<{
        date: string;
        customers: number;
    }>;
    lastUpdated: Date;
}
interface ServicesAnalytics {
    totalRevenue: KPIData;
    completedAppointments: KPIData;
    averageTicket: KPIData;
    topServices: Array<{
        name: string;
        appointments: number;
        revenue: number;
        averageTicket: number;
    }>;
    professionalsPerformance: Array<{
        name: string;
        appointments: number;
        revenue: number;
        rating?: number;
    }>;
    revenueByDay: Array<{
        date: string;
        revenue: number;
    }>;
    paymentStatusDistribution: Array<{
        status: string;
        count: number;
        amount: number;
    }>;
    lastUpdated: Date;
}
interface AgendamentoAnalytics {
    todayAppointments: number;
    weekAppointments: number;
    noShowRate: number;
    bookingEfficiency: number;
    upcomingAppointments: Array<{
        id: string;
        customerName: string;
        serviceName: string;
        datetime: Date;
    }>;
    appointmentsByStatus: Array<{
        status: string;
        count: number;
        percentage: number;
    }>;
    lastUpdated: Date;
}
/**
 * Analytics Engine Central
 * Responsável por calcular todas as métricas e KPIs do sistema
 */
export declare class AnalyticsEngine {
    private prisma;
    constructor();
    /**
     * Calcula todas as estatísticas relacionadas ao CRM
     */
    calculateCRMStats(companyId: string, period?: PeriodFilter): Promise<CRMAnalytics>;
    /**
     * Obtém estatísticas de CRM para um período específico
     */
    private getCRMPeriodStats;
    /**
     * Calcula todas as estatísticas relacionadas aos Services
     */
    calculateServicesStats(companyId: string, period?: PeriodFilter): Promise<ServicesAnalytics>;
    /**
     * Obtém estatísticas de Services para um período específico
     */
    private getServicesPeriodStats;
    /**
     * Calcula todas as estatísticas relacionadas ao Agendamento
     */
    calculateAgendamentoStats(companyId: string, period?: PeriodFilter): Promise<AgendamentoAnalytics>;
    /**
     * Calcula KPI com tendência comparativa
     */
    private calculateKPIWithTrend;
    /**
     * Calcula taxa de conversão de prospects para clientes ativos
     */
    private calculateConversionRate;
    /**
     * Obtém distribuição de clientes por fonte
     */
    private getCustomersBySource;
    /**
     * Obtém distribuição de interações por tipo
     */
    private getInteractionsByType;
    /**
     * Obtém dados de crescimento de clientes nos últimos 30 dias
     */
    private getCustomerGrowthChart;
    /**
     * Obtém top 5 serviços mais populares
     */
    private getTopServices;
    /**
     * Obtém performance dos profissionais
     */
    private getProfessionalsPerformance;
    /**
     * Obtém receita por dia nos últimos 30 dias
     */
    private getRevenueByDay;
    /**
     * Obtém distribuição por status de pagamento
     */
    private getPaymentStatusDistribution;
    /**
     * Calcula eficiência de agendamento (% de ocupação)
     */
    private calculateBookingEfficiency;
    /**
     * Obtém próximos agendamentos
     */
    private getUpcomingAppointments;
    /**
     * Obtém distribuição de agendamentos por status
     */
    private getAppointmentsByStatus;
    /**
     * Fecha a conexão com o banco de dados
     */
    disconnect(): Promise<void>;
}
export default AnalyticsEngine;
//# sourceMappingURL=AnalyticsEngine.d.ts.map