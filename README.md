# Crosswim API Base

NestJS 10 + Sequelize (PostgreSQL) base: authentication (JWT, email verification, password reset), users/roles, and a decorator-driven CRUD core (`@Crud()`).

```bash
cp .env.example .env     # set DB_* and JWT_SECRET (>= 32 chars)
docker compose up -d db
npm install
npm run migrate && npm run seed
npm run start:dev        # http://localhost:3001/v1, Swagger at /v1/docs
```

```bash
npm test                 # unit
npm run test:e2e         # @Crud e2e
npm run lint
```

Documentation (Vietnamese): [docs/README.md](docs/README.md)
