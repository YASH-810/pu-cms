require('dotenv').config();

const shared = {
  client: 'pg',
  migrations: {
    directory: './src/db/migrations',
    extension: 'cjs',
    loadExtensions: ['.cjs'],
    tableName: 'knex_migrations'
  },
  pool: {
    min: 0,
    max: 10
  }
};

const makeConfig = () => ({
  ...shared,
  connection: process.env.DATABASE_URL
});

module.exports = {
  development: makeConfig(),
  local: makeConfig(),
  staging: makeConfig(),
  production: {
    ...makeConfig(),
    pool: {
      min: 2,
      max: 20
    }
  },
  test: makeConfig()
};
