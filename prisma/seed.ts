import { PrismaClient, type ActivityType, type FollowUpStatus, type LeadPriority, type LeadSource, type LeadStage, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const password = "Password123!";

const users: Array<{
  email: string;
  name: string;
  role: UserRole;
}> = [
  {
    email: "admin@crm.local",
    name: "Alex Admin",
    role: "ADMIN",
  },
  {
    email: "manager@crm.local",
    name: "Maya Manager",
    role: "MANAGER",
  },
  {
    email: "rep@crm.local",
    name: "Riley Rep",
    role: "REP",
  },
];

const leads: Array<{
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  description: string;
  stage: LeadStage;
  source: LeadSource;
  priority: LeadPriority;
  valueCents: number;
  activityType: ActivityType;
  followUpStatus: FollowUpStatus;
}> = [
  {
    companyName: "Northwind Logistics",
    contactName: "Dana Cole",
    email: "dana@northwind.example",
    phone: "555-1100",
    description: "Interested in rolling CRM usage out across regional sales teams.",
    stage: "QUALIFIED",
    source: "REFERRAL",
    priority: "HIGH",
    valueCents: 250000,
    activityType: "LEAD_CREATED",
    followUpStatus: "PENDING",
  },
  {
    companyName: "Harbor Health Group",
    contactName: "Luis Ramos",
    email: "luis@harbor.example",
    phone: "555-2200",
    description: "Evaluating lead tracking and reminder workflows before Q3 budgeting.",
    stage: "PROPOSAL",
    source: "WEBSITE",
    priority: "MEDIUM",
    valueCents: 180000,
    activityType: "STAGE_CHANGED",
    followUpStatus: "PENDING",
  },
  {
    companyName: "Summit Devices",
    contactName: "Priya Nair",
    email: "priya@summit.example",
    phone: "555-3300",
    description: "Requested a tighter handoff between SDR and account executive ownership.",
    stage: "NEGOTIATION",
    source: "OUTBOUND",
    priority: "HIGH",
    valueCents: 400000,
    activityType: "FOLLOW_UP_CREATED",
    followUpStatus: "COMPLETED",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  const createdUsers = await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          role: user.role,
          passwordHash,
          isActive: true,
        },
        create: {
          ...user,
          passwordHash,
        },
      }),
    ),
  );

  const admin = createdUsers[0];
  const manager = createdUsers[1];
  const rep = createdUsers[2];

  await prisma.activityLog.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.note.deleteMany();
  await prisma.lead.deleteMany();

  for (const lead of leads) {
    const createdLead = await prisma.lead.create({
      data: {
        companyName: lead.companyName,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        description: lead.description,
        stage: lead.stage,
        source: lead.source,
        priority: lead.priority,
        valueCents: lead.valueCents,
        ownerId: rep.id,
        createdById: manager.id,
        lastContactedAt: new Date(),
        nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      },
    });

    await prisma.note.create({
      data: {
        leadId: createdLead.id,
        authorId: manager.id,
        body: `Initial context for ${lead.companyName}: keep the technical champion looped into every pricing conversation.`,
      },
    });

    await prisma.followUp.create({
      data: {
        leadId: createdLead.id,
        ownerId: rep.id,
        createdById: manager.id,
        description: `Follow up with ${lead.contactName} on the next decision checkpoint.`,
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
        status: lead.followUpStatus,
        completedAt: lead.followUpStatus === "COMPLETED" ? new Date() : null,
      },
    });

    await prisma.activityLog.createMany({
      data: [
        {
          leadId: createdLead.id,
          actorId: manager.id,
          type: "LEAD_CREATED",
          message: "Lead created from seeded demo data.",
        },
        {
          leadId: createdLead.id,
          actorId: rep.id,
          type: lead.activityType,
          message: "Demo workflow activity recorded for the lead timeline.",
        },
      ],
    });
  }

  console.log("Seed complete.");
  console.log("Demo users:");
  console.log(`- ${admin.email} / ${password}`);
  console.log(`- ${manager.email} / ${password}`);
  console.log(`- ${rep.email} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
