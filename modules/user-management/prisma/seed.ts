import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create demo company
  const demoCompany = await prisma.company.upsert({
    where: { email: 'demo@nexuserp.com' },
    update: {},
    create: {
      name: 'Empresa Demo Nexus',
      email: 'demo@nexuserp.com',
      phone: '+55 11 99999-9999',
      cnpj: '00.000.000/0001-00',
      address: 'Rua Demo, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      plan: 'premium',
      maxUsers: 50,
      settings: {
        theme: 'light',
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        notifications: {
          email: true,
          system: true,
        },
      },
    },
  });

  console.log(`✅ Company created: ${demoCompany.name}`);

  // Hash password for demo users
  const defaultPassword = await bcrypt.hash('123456789', 12);

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nexuserp.com' },
    update: {},
    create: {
      email: 'admin@nexuserp.com',
      password: defaultPassword,
      firstName: 'Admin',
      lastName: 'Sistema',
      phone: '+55 11 98888-8888',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      companyId: demoCompany.id,
      preferences: {
        theme: 'light',
        language: 'pt-BR',
        notifications: true,
        dashboard: {
          showStats: true,
          showCharts: true,
        },
      },
    },
  });

  console.log(`✅ Admin user created: ${adminUser.email}`);

  // Create manager user
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@nexuserp.com' },
    update: {},
    create: {
      email: 'manager@nexuserp.com',
      password: defaultPassword,
      firstName: 'Gerente',
      lastName: 'Demo',
      phone: '+55 11 97777-7777',
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      companyId: demoCompany.id,
      createdBy: adminUser.id,
    },
  });

  console.log(`✅ Manager user created: ${managerUser.email}`);

  // Create regular users
  const users = [
    {
      email: 'usuario1@nexuserp.com',
      firstName: 'João',
      lastName: 'Silva',
      phone: '+55 11 96666-6666',
    },
    {
      email: 'usuario2@nexuserp.com',
      firstName: 'Maria',
      lastName: 'Santos',
      phone: '+55 11 95555-5555',
    },
    {
      email: 'usuario3@nexuserp.com',
      firstName: 'Pedro',
      lastName: 'Oliveira',
      phone: '+55 11 94444-4444',
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        password: defaultPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        companyId: demoCompany.id,
        createdBy: adminUser.id,
      },
    });
    console.log(`✅ User created: ${user.email}`);
  }

  // Create audit logs for demo purposes
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        companyId: demoCompany.id,
        action: 'CREATE_COMPANY',
        entityType: 'COMPANY',
        entityId: demoCompany.id,
        newValues: {
          name: demoCompany.name,
          plan: demoCompany.plan,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script',
      },
      {
        userId: adminUser.id,
        companyId: demoCompany.id,
        action: 'CREATE_USER',
        entityType: 'USER',
        entityId: managerUser.id,
        newValues: {
          email: managerUser.email,
          role: managerUser.role,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Seed Script',
      },
    ],
  });

  console.log('✅ Audit logs created');

  console.log('🎉 Database seeding completed!');
  console.log('\n📋 Demo Credentials:');
  console.log('Admin: admin@nexuserp.com / 123456789');
  console.log('Manager: manager@nexuserp.com / 123456789');
  console.log('User: usuario1@nexuserp.com / 123456789');
  console.log('\n🏢 Company: Empresa Demo Nexus');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });