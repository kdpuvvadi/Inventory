import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;

const APP_USER_EMAIL = process.env.APP_USER_EMAIL || 'admin@company.com';
const APP_USER_PASSWORD = process.env.APP_USER_PASSWORD || 'Admin123456!';

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'Error: Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables.'
    );
    process.exit(1);
  }

  console.log(`Connecting to ${PB_URL}...`);
  await pb
    .collection('_superusers')
    .authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('Authenticated as superuser.');

  try {
    await pb
      .collection('users')
      .getFirstListItem(`email = "${APP_USER_EMAIL}"`);

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

      console.log(`Application user created: ${user.email}`);
    } else {
      throw err;
    }
  }

  console.log('\nSeed completed successfully.');
  console.log('\nLogin to the app with:');
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
