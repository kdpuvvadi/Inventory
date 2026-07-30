/**
 * Seed script for Inventory Management PocketBase backend.
 *
 * Prerequisites:
 *   1. PocketBase running (./pocketbase serve)
 *   2. pb_schema.json imported
 *   3. Superuser account created
 *
 * Usage:
 *   cd pocketbase
 *   npm install
 *   PB_ADMIN_EMAIL=admin@inventory.local PB_ADMIN_PASSWORD=secret npm run seed
 *
 * Environment variables:
 *   PB_URL              - PocketBase URL (default: http://127.0.0.1:8090)
 *   PB_ADMIN_EMAIL      - Superuser email
 *   PB_ADMIN_PASSWORD   - Superuser password
 *   PB_APP_USER_EMAIL   - Application user email (default: admin@company.com)
 *   PB_APP_USER_PASSWORD - Application user password (default: Admin123456!)
 */

import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const APP_USER_EMAIL = process.env.PB_APP_USER_EMAIL || 'admin@company.com';
const APP_USER_PASSWORD = process.env.PB_APP_USER_PASSWORD || 'Admin123456!';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function upsertByFilter(collection, filter, data) {
  try {
    const existing = await pb.collection(collection).getFirstListItem(filter);
    return await pb.collection(collection).update(existing.id, data);
  } catch (err) {
    if (err?.status === 404) {
      return await pb.collection(collection).create(data);
    }
    throw err;
  }
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Error: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables.');
    console.error('Example: PB_ADMIN_EMAIL=admin@inventory.local PB_ADMIN_PASSWORD=secret npm run seed');
    process.exit(1);
  }

  console.log(`Connecting to ${PB_URL}...`);
  await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Authenticated as superuser.');

  // --- App settings (singleton) ---
  const settings = await upsertByFilter(
    'app_settings',
    'company_name != ""',
    {
      company_name: 'Acme Inventory Co.',
      currency: 'USD',
      low_stock_threshold: 10,
      theme_default: 'light',
    }
  );
  console.log('App settings:', settings.id);

  // --- Warehouse ---
  const warehouse = await upsertByFilter('warehouses', 'code = "MAIN"', {
    name: 'Main Warehouse',
    code: 'MAIN',
    address: '100 Industrial Park Drive, Suite 1',
    is_default: true,
  });
  console.log('Warehouse:', warehouse.name);

  // --- Manufacturers ---
  const manufacturers = {};
  for (const m of [
    { name: 'Cisco Systems', website: 'https://www.cisco.com', contact_person: 'John Smith', phone: '+1-800-555-0101', email: 'enterprise@cisco.com' },
    { name: 'Dell Technologies', website: 'https://www.dell.com', contact_person: 'Jane Doe', phone: '+1-800-555-0102', email: 'business@dell.com' },
    { name: 'APC by Schneider', website: 'https://www.apc.com', contact_person: 'Mike Johnson', phone: '+1-800-555-0103', email: 'sales@apc.com' },
  ]) {
    const rec = await upsertByFilter('manufacturers', `name = "${m.name}"`, m);
    manufacturers[m.name] = rec.id;
  }
  console.log('Manufacturers:', Object.keys(manufacturers).length);

  // --- Suppliers ---
  const suppliers = {};
  for (const s of [
    { name: 'TechDistro Inc.', contact_person: 'Sarah Lee', phone: '+1-555-100-2000', email: 'orders@techdistro.com', gst_vat_number: 'GST-100200300' },
    { name: 'Global Parts Supply', contact_person: 'Tom Brown', phone: '+1-555-100-3000', email: 'sales@globalparts.com', gst_vat_number: 'GST-200300400' },
  ]) {
    const rec = await upsertByFilter('suppliers', `name = "${s.name}"`, s);
    suppliers[s.name] = rec.id;
  }
  console.log('Suppliers:', Object.keys(suppliers).length);

  // --- Customers ---
  const customers = {};
  for (const c of [
    { name: 'Metro Hospital', contact_person: 'Dr. Emily Chen', phone: '+1-555-200-1000', email: 'it@metrohospital.org' },
    { name: 'City University', contact_person: 'Prof. Robert Kim', phone: '+1-555-200-2000', email: 'procurement@cityuniversity.edu' },
  ]) {
    const rec = await upsertByFilter('customers', `name = "${c.name}"`, c);
    customers[c.name] = rec.id;
  }
  console.log('Customers:', Object.keys(customers).length);

  // --- Categories ---
  const categories = {};
  const catData = [
    { name: 'Networking', description: 'Network infrastructure equipment' },
    { name: 'Servers', description: 'Server hardware and components' },
    { name: 'Power & UPS', description: 'Power distribution and backup' },
    { name: 'Switches', description: 'Network switches', parentName: 'Networking' },
    { name: 'Routers', description: 'Network routers', parentName: 'Networking' },
  ];
  for (const c of catData.filter((x) => !x.parentName)) {
    const rec = await upsertByFilter('categories', `name = "${c.name}"`, {
      name: c.name,
      description: c.description,
    });
    categories[c.name] = rec.id;
  }
  for (const c of catData.filter((x) => x.parentName)) {
    const rec = await upsertByFilter('categories', `name = "${c.name}"`, {
      name: c.name,
      description: c.description,
      parent: categories[c.parentName],
    });
    categories[c.name] = rec.id;
  }
  console.log('Categories:', Object.keys(categories).length);

  // --- Products ---
  const products = {};
  const productData = [
    {
      asset_tag: 'NET-SW-001',
      name: 'Cisco Catalyst 9300 48-port Switch',
      description: '48-port Gigabit Ethernet switch with PoE+',
      model: 'C9300-48P',
      manufacturer: manufacturers['Cisco Systems'],
      supplier: suppliers['TechDistro Inc.'],
      sku: 'C9300-48P-E',
      category: categories['Networking'],
      sub_category: categories['Switches'],
      status: 'in_stock',
      unit_cost: 4500,
      unit_of_measure: 'each',
      tags: ['network', 'switch', 'poe'],
    },
    {
      asset_tag: 'SRV-DL-001',
      name: 'Dell PowerEdge R750 Server',
      description: '2U rack server, dual Xeon, 64GB RAM',
      model: 'PowerEdge R750',
      manufacturer: manufacturers['Dell Technologies'],
      supplier: suppliers['Global Parts Supply'],
      sku: 'R750-BASE',
      category: categories['Servers'],
      status: 'in_stock',
      unit_cost: 8200,
      unit_of_measure: 'each',
      tags: ['server', 'rack'],
    },
    {
      asset_tag: 'PWR-UPS-001',
      name: 'APC Smart-UPS 3000VA',
      description: 'Rack-mount UPS 3000VA/2700W',
      model: 'SMT3000RM2UC',
      manufacturer: manufacturers['APC by Schneider'],
      supplier: suppliers['TechDistro Inc.'],
      sku: 'SMT3000RM2UC',
      category: categories['Power & UPS'],
      status: 'in_stock',
      unit_cost: 1200,
      unit_of_measure: 'each',
      tags: ['ups', 'power'],
    },
    {
      asset_tag: 'NET-RT-001',
      name: 'Cisco ISR 4331 Router',
      description: 'Integrated services router for branch offices',
      model: 'ISR4331/K9',
      manufacturer: manufacturers['Cisco Systems'],
      supplier: suppliers['Global Parts Supply'],
      sku: 'ISR4331/K9',
      category: categories['Networking'],
      sub_category: categories['Routers'],
      status: 'in_stock',
      unit_cost: 2800,
      unit_of_measure: 'each',
      tags: ['router', 'network'],
    },
  ];

  for (const p of productData) {
    const rec = await upsertByFilter('products', `asset_tag = "${p.asset_tag}"`, p);
    products[p.asset_tag] = rec.id;
  }
  console.log('Products:', Object.keys(products).length);

  // --- Inventory ---
  const inventoryData = [
    { product: products['NET-SW-001'], quantity: 25, available: 22, reserved: 3, location: 'A-01-01', min_stock: 5, max_stock: 50, reorder_level: 10 },
    { product: products['SRV-DL-001'], quantity: 8, available: 6, reserved: 2, location: 'B-02-01', min_stock: 2, max_stock: 20, reorder_level: 4 },
    { product: products['PWR-UPS-001'], quantity: 15, available: 15, reserved: 0, location: 'C-01-03', min_stock: 3, max_stock: 30, reorder_level: 5 },
    { product: products['NET-RT-001'], quantity: 10, available: 9, reserved: 1, location: 'A-02-02', min_stock: 2, max_stock: 25, reorder_level: 5 },
  ];

  for (const inv of inventoryData) {
    await upsertByFilter(
      'inventory',
      `product = "${inv.product}" && warehouse = "${warehouse.id}"`,
      { ...inv, warehouse: warehouse.id, damaged: 0 }
    );
  }
  console.log('Inventory records:', inventoryData.length);

  // --- Project ---
  const project = await upsertByFilter('projects', 'name = "Metro Hospital Network Upgrade"', {
    name: 'Metro Hospital Network Upgrade',
    customer: customers['Metro Hospital'],
    description: 'Phase 1 network infrastructure refresh for Metro Hospital IT department.',
    start_date: '2026-01-15',
    end_date: '2026-06-30',
    status: 'active',
  });
  console.log('Project:', project.name);

  // --- Application administrator user ---
  try {
    await pb.collection('users').getFirstListItem(`email = "${APP_USER_EMAIL}"`);
    console.log(`Application user already exists: ${APP_USER_EMAIL}`);
  } catch (err) {
    if (err?.status === 404) {
      const user = await pb.collection('users').create({
        email: APP_USER_EMAIL,
        password: APP_USER_PASSWORD,
        passwordConfirm: APP_USER_PASSWORD,
        name: 'System Administrator',
        role: 'administrator',
        verified: true,
      });
      console.log('Application user created:', user.email);
    } else {
      throw err;
    }
  }

  console.log('\nSeed completed successfully.');
  console.log(`\nLogin to the app with:`);
  console.log(`  Email:    ${APP_USER_EMAIL}`);
  console.log(`  Password: ${APP_USER_PASSWORD}`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err?.message || err);
  if (err?.response) {
    console.error('Details:', JSON.stringify(err.response, null, 2));
  }
  process.exit(1);
});
