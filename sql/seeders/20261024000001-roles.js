'use strict';

const ROLES = [
  ['SUPER_ADMIN', 'Full access, including managing admins and roles'],
  ['ADMIN', 'Manage users and application data'],
  ['USER', 'Default role for registered accounts'],
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'Roles',
      ROLES.map(([name, description]) => ({
        id: Sequelize.literal('uuid_generate_v4()'),
        name,
        description,
        createdAt: now,
        updatedAt: now,
      })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Roles', {
      name: { [Sequelize.Op.in]: ROLES.map(([name]) => name) },
    });
  },
};
