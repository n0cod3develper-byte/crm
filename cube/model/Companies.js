cube('Companies', {
  sql: `SELECT * FROM companies WHERE deleted_at IS NULL`,

  measures: {
    count: {
      type: `count`,
      drillMembers: [id, name, nit, industry, city]
    }
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true
    },
    name: {
      sql: `name`,
      type: `string`
    },
    nit: {
      sql: `nit`,
      type: `string`
    },
    industry: {
      sql: `industry`,
      type: `string`
    },
    city: {
      sql: `city`,
      type: `string`
    },
    createdAt: {
      sql: `created_at`,
      type: `time`
    }
  }
});
