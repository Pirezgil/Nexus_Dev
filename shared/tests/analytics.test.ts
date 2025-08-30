import { AnalyticsEngine } from '../services/AnalyticsEngine'
import { AnalyticsCacheService } from '../services/AnalyticsCacheService'
import { StatsCalculatorJob } from '../jobs/StatsCalculatorJob'
import { PrismaClient } from '@prisma/client'

// Mock do Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    customer: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    customerInteraction: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    appointmentCompleted: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    appointment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    service: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    professional: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    customerStats: {
      upsert: jest.fn(),
    },
    serviceStats: {
      upsert: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}))

// Mock do Redis
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    disconnect: jest.fn(),
    on: jest.fn(),
  })),
}))

describe('Analytics Engine', () => {
  let analytics: AnalyticsEngine
  let mockPrisma: any

  beforeEach(() => {
    analytics = new AnalyticsEngine()
    mockPrisma = (analytics as any).prisma
    
    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('CRM Analytics', () => {
    it('should calculate CRM stats correctly', async () => {
      // Mock data
      mockPrisma.customer.count
        .mockResolvedValueOnce(100) // total customers current
        .mockResolvedValueOnce(80)  // active customers
        .mockResolvedValueOnce(25)  // new customers current
        .mockResolvedValueOnce(90)  // total customers previous
        .mockResolvedValueOnce(75)  // active customers previous
        .mockResolvedValueOnce(20)  // new customers previous

      mockPrisma.customerInteraction.groupBy
        .mockResolvedValueOnce([
          { customerId: '1', _count: { id: 5 } },
          { customerId: '2', _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { customerId: '3', _count: { id: 4 } },
        ])

      const stats = await analytics.calculateCRMStats('test-company-id')

      expect(stats.totalCustomers).toBeDefined()
      expect(stats.totalCustomers.value).toBe(100)
      expect(stats.totalCustomers.previousValue).toBe(90)
      expect(stats.totalCustomers.trend).toBe('up')

      expect(stats.activeCustomers).toBeDefined()
      expect(stats.activeCustomers.value).toBe(80)

      expect(stats.newCustomersThisMonth).toBeDefined()
      expect(stats.newCustomersThisMonth.value).toBe(25)
    })

    it('should calculate trends correctly', async () => {
      mockPrisma.customer.count
        .mockResolvedValueOnce(120) // current higher than previous
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(100) // previous value
        .mockResolvedValueOnce(75)
        .mockResolvedValueOnce(25)

      mockPrisma.customerInteraction.groupBy
        .mockResolvedValue([])

      const stats = await analytics.calculateCRMStats('test-company-id')

      // Should show positive trend
      expect(stats.totalCustomers.trend).toBe('up')
      expect(stats.totalCustomers.changePercent).toContain('+20%')
    })
  })

  describe('Services Analytics', () => {
    it('should calculate services stats correctly', async () => {
      // Mock aggregate data
      mockPrisma.appointmentCompleted.aggregate
        .mockResolvedValueOnce({
          _sum: { totalAmount: 50000 },
          _count: { id: 100 },
          _avg: { totalAmount: 500 }
        })
        .mockResolvedValueOnce({
          _sum: { totalAmount: 45000 },
          _count: { id: 90 },
          _avg: { totalAmount: 500 }
        })

      const stats = await analytics.calculateServicesStats('test-company-id')

      expect(stats.totalRevenue).toBeDefined()
      expect(stats.totalRevenue.value).toBe(50000)
      expect(stats.totalRevenue.previousValue).toBe(45000)

      expect(stats.completedAppointments).toBeDefined()
      expect(stats.completedAppointments.value).toBe(100)

      expect(stats.averageTicket).toBeDefined()
      expect(stats.averageTicket.value).toBe(500)
    })

    it('should get top services correctly', async () => {
      mockPrisma.appointmentCompleted.groupBy.mockResolvedValue([
        {
          serviceId: 'service-1',
          _count: { id: 20 },
          _sum: { totalAmount: 6000 }
        },
        {
          serviceId: 'service-2',
          _count: { id: 15 },
          _sum: { totalAmount: 4500 }
        }
      ])

      mockPrisma.service.findUnique
        .mockResolvedValueOnce({ name: 'Corte + Escova' })
        .mockResolvedValueOnce({ name: 'Massagem' })

      // Mock aggregate for current and previous periods
      mockPrisma.appointmentCompleted.aggregate
        .mockResolvedValue({
          _sum: { totalAmount: 10000 },
          _count: { id: 50 },
          _avg: { totalAmount: 200 }
        })

      const stats = await analytics.calculateServicesStats('test-company-id')

      expect(stats.topServices).toBeDefined()
      expect(stats.topServices).toHaveLength(2)
      expect(stats.topServices[0].name).toBe('Corte + Escova')
      expect(stats.topServices[0].appointments).toBe(20)
      expect(stats.topServices[0].revenue).toBe(6000)
    })
  })

  describe('Agendamento Analytics', () => {
    it('should calculate agendamento stats correctly', async () => {
      // Mock appointment counts
      mockPrisma.appointment.count
        .mockResolvedValueOnce(15) // today appointments
        .mockResolvedValueOnce(45) // week appointments
        .mockResolvedValueOnce(200) // total scheduled (30 days)
        .mockResolvedValueOnce(20) // no shows

      mockPrisma.appointment.findMany.mockResolvedValue([
        {
          id: '1',
          appointment_date: new Date(),
          appointment_time: new Date(),
        }
      ])

      const stats = await analytics.calculateAgendamentoStats('test-company-id')

      expect(stats.todayAppointments).toBe(15)
      expect(stats.weekAppointments).toBe(45)
      expect(stats.noShowRate).toBe(10) // 20/200 * 100
      expect(stats.upcomingAppointments).toBeDefined()
    })
  })
})

describe('Analytics Cache Service', () => {
  let cache: AnalyticsCacheService
  let mockRedis: any

  beforeEach(() => {
    cache = new AnalyticsCacheService()
    mockRedis = (cache as any).redis
    jest.clearAllMocks()
  })

  it('should cache and retrieve dashboard KPIs', async () => {
    const testData = {
      totalCustomers: { value: 100, previousValue: 90, trend: 'up' },
      monthlyRevenue: { value: 50000, previousValue: 45000, trend: 'up' }
    }

    // Mock Redis get to return null (cache miss)
    mockRedis.get.mockResolvedValue(null)
    mockRedis.setex.mockResolvedValue('OK')

    // Set cache
    await cache.setDashboardKPIs('company-1', 'month', testData)
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'analytics:dashboard:kpis:company-1:month',
      expect.any(Number),
      JSON.stringify(testData)
    )

    // Mock Redis get to return cached data
    mockRedis.get.mockResolvedValue(JSON.stringify(testData))

    // Get from cache
    const result = await cache.getDashboardKPIs('company-1', 'month')
    expect(result).toEqual(testData)
  })

  it('should handle cache invalidation', async () => {
    mockRedis.keys.mockResolvedValue([
      'analytics:dashboard:kpis:company-1:month',
      'analytics:crm:stats:company-1'
    ])
    mockRedis.del.mockResolvedValue(2)

    await cache.invalidateCompany('company-1')

    expect(mockRedis.keys).toHaveBeenCalled()
    expect(mockRedis.del).toHaveBeenCalled()
  })

  it('should provide cache health check', async () => {
    mockRedis.ping.mockResolvedValue('PONG')

    const isHealthy = await cache.healthCheck()
    expect(isHealthy).toBe(true)

    mockRedis.ping.mockRejectedValue(new Error('Connection failed'))
    
    const isUnhealthy = await cache.healthCheck()
    expect(isUnhealthy).toBe(false)
  })
})

describe('Stats Calculator Job', () => {
  let job: StatsCalculatorJob
  let mockPrisma: any

  beforeEach(() => {
    job = new StatsCalculatorJob()
    mockPrisma = (job as any).prisma
    jest.clearAllMocks()
  })

  it('should calculate stats for multiple companies', async () => {
    // Mock companies data
    mockPrisma.customer.groupBy.mockResolvedValue([
      { companyId: 'company-1', _count: { id: 50 } },
      { companyId: 'company-2', _count: { id: 30 } }
    ])

    // Mock the analytics calculations
    const mockAnalytics = (job as any).analytics
    mockAnalytics.calculateCRMStats = jest.fn().mockResolvedValue({
      totalCustomers: { value: 100 },
      activeCustomers: { value: 80 },
      averageInteractions: { value: 2.5 }
    })

    mockAnalytics.calculateServicesStats = jest.fn().mockResolvedValue({
      totalRevenue: { value: 50000 },
      completedAppointments: { value: 100 },
      averageTicket: { value: 500 }
    })

    // Mock database save operations
    mockPrisma.customerStats.upsert.mockResolvedValue({})
    mockPrisma.serviceStats.upsert.mockResolvedValue({})

    // Helper method counts
    mockPrisma.customer.count.mockResolvedValue(10)
    mockPrisma.service.count.mockResolvedValue(5)
    mockPrisma.professional.count.mockResolvedValue(3)
    mockPrisma.appointment.count.mockResolvedValue(50)
    mockPrisma.customerInteraction.count.mockResolvedValue(200)
    mockPrisma.customerNote.count.mockResolvedValue(150)

    // Execute the job
    await (job as any).calculateStatsForAllCompanies()

    // Verify stats were calculated for all companies
    expect(mockAnalytics.calculateCRMStats).toHaveBeenCalledTimes(2)
    expect(mockAnalytics.calculateServicesStats).toHaveBeenCalledTimes(2)

    // Verify data was saved
    expect(mockPrisma.customerStats.upsert).toHaveBeenCalledTimes(2)
    expect(mockPrisma.serviceStats.upsert).toHaveBeenCalledTimes(2)
  })

  it('should handle errors gracefully', async () => {
    // Mock error in company stats calculation
    mockPrisma.customer.groupBy.mockResolvedValue([
      { companyId: 'company-1', _count: { id: 50 } }
    ])

    const mockAnalytics = (job as any).analytics
    mockAnalytics.calculateCRMStats = jest.fn().mockRejectedValue(
      new Error('Database connection failed')
    )

    // Should not throw error, just log and continue
    await expect((job as any).calculateStatsForAllCompanies()).resolves.toBeUndefined()
  })
})

describe('Integration Tests', () => {
  it('should calculate and cache dashboard data end-to-end', async () => {
    const analytics = new AnalyticsEngine()
    const cache = new AnalyticsCacheService()

    const mockPrisma = (analytics as any).prisma

    // Mock all necessary data
    mockPrisma.customer.count.mockResolvedValue(100)
    mockPrisma.customerInteraction.groupBy.mockResolvedValue([])
    mockPrisma.appointmentCompleted.aggregate.mockResolvedValue({
      _sum: { totalAmount: 50000 },
      _count: { id: 100 },
      _avg: { totalAmount: 500 }
    })
    mockPrisma.appointment.count.mockResolvedValue(15)

    const mockRedis = (cache as any).redis
    mockRedis.get.mockResolvedValue(null)
    mockRedis.setex.mockResolvedValue('OK')

    // Calculate stats
    const crmStats = await analytics.calculateCRMStats('test-company')
    const servicesStats = await analytics.calculateServicesStats('test-company')

    expect(crmStats.totalCustomers.value).toBe(100)
    expect(servicesStats.totalRevenue.value).toBe(50000)

    // Cache the results
    await cache.setDashboardKPIs('test-company', 'month', {
      totalCustomers: crmStats.totalCustomers,
      monthlyRevenue: servicesStats.totalRevenue
    })

    expect(mockRedis.setex).toHaveBeenCalled()
  })
})

// Cleanup
afterAll(async () => {
  // Close any open connections
  jest.clearAllMocks()
})