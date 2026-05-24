const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create warehouse
  const warehouse = await prisma.warehouse.create({
    data: {
      name: "Main Warehouse",
      location: "Surat",
    },
  });

  // Product 1
  await prisma.product.create({
    data: {
      name: "Gaming Laptop",
      description: "High performance gaming laptop",
      price: 75000,
      stockLevels: {
        create: {
          warehouseId: warehouse.id,
          total: 15,
          reserved: 0,
        },
      },
    },
  });

  // Product 2
  await prisma.product.create({
    data: {
      name: "Wireless Mouse",
      description: "Bluetooth wireless mouse",
      price: 1200,
      stockLevels: {
        create: {
          warehouseId: warehouse.id,
          total: 50,
          reserved: 0,
        },
      },
    },
  });

  // Product 3
  await prisma.product.create({
    data: {
      name: "Mechanical Keyboard",
      description: "RGB mechanical keyboard",
      price: 3500,
      stockLevels: {
        create: {
          warehouseId: warehouse.id,
          total: 25,
          reserved: 0,
        },
      },
    },
  });

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
