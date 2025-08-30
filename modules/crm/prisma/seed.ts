import { PrismaClient, CustomerStatus, InteractionType, NoteType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting CRM database seeding...');

  // Sample company IDs (these should match companies from User Management)
  const sampleCompanyIds = [
    '123e4567-e89b-12d3-a456-426614174000', // Sample company 1
    '123e4567-e89b-12d3-a456-426614174001', // Sample company 2
  ];

  // Sample user IDs (these should match users from User Management)
  const sampleUserIds = [
    '223e4567-e89b-12d3-a456-426614174000', // Sample user 1
    '223e4567-e89b-12d3-a456-426614174001', // Sample user 2
    '223e4567-e89b-12d3-a456-426614174002', // Sample user 3
  ];

  // Sample customer data
  const sampleCustomers = [
    {
      companyId: sampleCompanyIds[0],
      name: 'Empresa ABC Ltda',
      email: 'contato@empresaabc.com.br',
      phone: '(11) 99999-8888',
      document: '12.345.678/0001-90',
      address: 'Rua das Flores, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      country: 'Brasil',
      status: CustomerStatus.ACTIVE,
      tags: ['vip', 'corporativo', 'tecnologia'],
      metadata: {
        industry: 'Tecnologia',
        employees: 50,
        revenue: 5000000,
      },
    },
    {
      companyId: sampleCompanyIds[0],
      name: 'João Silva',
      email: 'joao.silva@email.com',
      phone: '(11) 98765-4321',
      document: '123.456.789-00',
      address: 'Av. Paulista, 456',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      country: 'Brasil',
      status: CustomerStatus.PROSPECT,
      tags: ['individual', 'interessado'],
      metadata: {
        source: 'website',
        campaign: 'google-ads-2024',
      },
    },
    {
      companyId: sampleCompanyIds[0],
      name: 'Maria Santos Comercio',
      email: 'maria@mariasantos.com.br',
      phone: '(21) 91234-5678',
      document: '98.765.432/0001-10',
      address: 'Rua Copacabana, 789',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22070-010',
      country: 'Brasil',
      status: CustomerStatus.ACTIVE,
      tags: ['comercio', 'regular'],
      metadata: {
        industry: 'Comércio',
        employees: 15,
      },
    },
    {
      companyId: sampleCompanyIds[1],
      name: 'Tech Innovation Corp',
      email: 'contact@techinnovation.com',
      phone: '(11) 94567-8901',
      document: '11.222.333/0001-44',
      address: 'Alameda Santos, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01418-100',
      country: 'Brasil',
      status: CustomerStatus.ACTIVE,
      tags: ['startup', 'inovacao', 'b2b'],
      metadata: {
        industry: 'Software',
        employees: 25,
        funding_stage: 'Series A',
      },
    },
    {
      companyId: sampleCompanyIds[0],
      name: 'Pedro Oliveira',
      email: 'pedro.oliveira@gmail.com',
      phone: '(85) 99876-5432',
      address: 'Rua do Sol, 321',
      city: 'Fortaleza',
      state: 'CE',
      zipCode: '60000-000',
      country: 'Brasil',
      status: CustomerStatus.INACTIVE,
      tags: ['individual', 'antigo'],
      metadata: {
        last_contact: '2023-06-15',
        reason_inactive: 'Mudou de cidade',
      },
    },
  ];

  console.log('📝 Creating sample customers...');

  // Create customers and store their IDs for relationships
  const createdCustomers = [];
  for (const customerData of sampleCustomers) {
    const customer = await prisma.customer.create({
      data: customerData,
    });
    createdCustomers.push(customer);
    console.log(`✅ Created customer: ${customer.name}`);
  }

  console.log('💬 Creating sample notes...');

  // Sample notes for customers
  const sampleNotes = [
    {
      customerId: createdCustomers[0].id,
      companyId: createdCustomers[0].companyId,
      content: 'Cliente muito interessado em nossos serviços de consultoria. Solicitou proposta detalhada.',
      type: NoteType.IMPORTANT,
      isPrivate: false,
      createdBy: sampleUserIds[0],
    },
    {
      customerId: createdCustomers[0].id,
      companyId: createdCustomers[0].companyId,
      content: 'Reunião marcada para próxima terça-feira às 14h.',
      type: NoteType.REMINDER,
      isPrivate: false,
      createdBy: sampleUserIds[0],
    },
    {
      customerId: createdCustomers[1].id,
      companyId: createdCustomers[1].companyId,
      content: 'Cliente demonstrou interesse no produto premium. Enviar material específico.',
      type: NoteType.FOLLOW_UP,
      isPrivate: false,
      createdBy: sampleUserIds[1],
    },
    {
      customerId: createdCustomers[1].id,
      companyId: createdCustomers[1].companyId,
      content: 'Informações confidenciais sobre orçamento discutidas.',
      type: NoteType.GENERAL,
      isPrivate: true,
      createdBy: sampleUserIds[1],
    },
    {
      customerId: createdCustomers[2].id,
      companyId: createdCustomers[2].companyId,
      content: 'Cliente fidelizado há 2 anos. Sempre pontual nos pagamentos.',
      type: NoteType.GENERAL,
      isPrivate: false,
      createdBy: sampleUserIds[0],
    },
  ];

  for (const noteData of sampleNotes) {
    await prisma.customerNote.create({
      data: noteData,
    });
  }

  console.log('🤝 Creating sample interactions...');

  // Sample interactions for customers
  const now = new Date();
  const sampleInteractions = [
    {
      customerId: createdCustomers[0].id,
      companyId: createdCustomers[0].companyId,
      type: InteractionType.CALL,
      title: 'Primeira ligação de contato',
      description: 'Cliente ligou interessado nos nossos serviços. Conversa durou 30 minutos.',
      metadata: {
        duration: 30,
        outcome: 'positive',
        next_action: 'send_proposal',
      },
      isCompleted: true,
      completedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      createdBy: sampleUserIds[0],
    },
    {
      customerId: createdCustomers[0].id,
      companyId: createdCustomers[0].companyId,
      type: InteractionType.EMAIL,
      title: 'Envio de proposta comercial',
      description: 'Enviada proposta detalhada conforme solicitado na ligação.',
      metadata: {
        email_subject: 'Proposta Comercial - Consultoria',
        attachments: ['proposta.pdf', 'apresentacao.pptx'],
      },
      isCompleted: true,
      completedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      createdBy: sampleUserIds[0],
    },
    {
      customerId: createdCustomers[0].id,
      companyId: createdCustomers[0].companyId,
      type: InteractionType.MEETING,
      title: 'Reunião de apresentação',
      description: 'Reunião para apresentar a proposta e esclarecer dúvidas.',
      metadata: {
        location: 'Escritório cliente',
        attendees: ['João (cliente)', 'Maria (decisor)', 'Eu'],
      },
      isCompleted: false,
      scheduledAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      createdBy: sampleUserIds[0],
    },
    {
      customerId: createdCustomers[1].id,
      companyId: createdCustomers[1].companyId,
      type: InteractionType.WHATSAPP,
      title: 'Contato inicial via WhatsApp',
      description: 'Cliente entrou em contato via WhatsApp solicitando informações.',
      metadata: {
        message_count: 8,
        response_time: 'immediate',
      },
      isCompleted: true,
      completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      createdBy: sampleUserIds[1],
    },
    {
      customerId: createdCustomers[1].id,
      companyId: createdCustomers[1].companyId,
      type: InteractionType.TASK,
      title: 'Elaborar proposta personalizada',
      description: 'Criar proposta específica para as necessidades do cliente.',
      metadata: {
        priority: 'high',
        estimated_hours: 4,
      },
      isCompleted: false,
      scheduledAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      createdBy: sampleUserIds[1],
    },
    {
      customerId: createdCustomers[2].id,
      companyId: createdCustomers[2].companyId,
      type: InteractionType.VISIT,
      title: 'Visita técnica',
      description: 'Visita para verificar implementação do projeto.',
      metadata: {
        duration: 120,
        findings: 'Tudo funcionando conforme esperado',
        satisfaction: 'high',
      },
      isCompleted: true,
      completedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      createdBy: sampleUserIds[0],
    },
  ];

  for (const interactionData of sampleInteractions) {
    await prisma.customerInteraction.create({
      data: interactionData,
    });
  }

  console.log('📊 Creating sample statistics...');

  // Create sample statistics (this would normally be calculated)
  for (const companyId of sampleCompanyIds) {
    await prisma.customerStats.upsert({
      where: { companyId },
      update: {},
      create: {
        companyId,
        totalCustomers: companyId === sampleCompanyIds[0] ? 4 : 1,
        activeCustomers: companyId === sampleCompanyIds[0] ? 2 : 1,
        prospectCustomers: companyId === sampleCompanyIds[0] ? 1 : 0,
        totalInteractions: companyId === sampleCompanyIds[0] ? 6 : 0,
        totalNotes: companyId === sampleCompanyIds[0] ? 4 : 0,
        averageInteractions: companyId === sampleCompanyIds[0] ? 1.5 : 0,
        lastCalculatedAt: new Date(),
      },
    });
  }

  console.log('✅ CRM database seeding completed!');
  console.log(`\n📈 Summary:`);
  console.log(`- Created ${createdCustomers.length} customers`);
  console.log(`- Created ${sampleNotes.length} notes`);
  console.log(`- Created ${sampleInteractions.length} interactions`);
  console.log(`- Created statistics for ${sampleCompanyIds.length} companies`);
  console.log(`\n🎯 You can now test the CRM module with sample data!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });