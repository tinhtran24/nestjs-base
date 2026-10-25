'use strict';

const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

// Configure through the environment; never commit real credentials.
const EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [[existing]] = await queryInterface.sequelize.query(
      'SELECT id FROM "Users" WHERE email = :email',
      { replacements: { email: EMAIL } },
    );
    if (existing) return;

    const [[role]] = await queryInterface.sequelize.query(
      `SELECT id FROM "Roles" WHERE name = 'SUPER_ADMIN'`,
    );
    if (!role) throw new Error('Run the roles seeder first');

    const now = new Date();
    const userId = randomUUID();
    await queryInterface.bulkInsert('Users', [
      {
        id: userId,
        email: EMAIL,
        password: await bcrypt.hash(PASSWORD, 10),
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await queryInterface.bulkInsert('Profiles', [
      { id: randomUUID(), userId, createdAt: now, updatedAt: now },
    ]);
    await queryInterface.bulkInsert('UserRoles', [
      { id: randomUUID(), userId, roleId: role.id, createdAt: now, updatedAt: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Users', { email: EMAIL });
  },
};
