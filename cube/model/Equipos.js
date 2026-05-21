cube('Equipos', {
  sql: `SELECT * FROM equipos WHERE deleted_at IS NULL`,

  joins: {
    Companies: {
      sql: `${CUBE}.empresa_id = ${Companies}.id`,
      relationship: `belongsTo`
    }
  },

  measures: {
    count: {
      type: `count`,
      drillMembers: [id, marca, modelo, serial]
    }
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true
    },
    marca: {
      sql: `marca`,
      type: `string`
    },
    modelo: {
      sql: `modelo`,
      type: `string`
    },
    serial: {
      sql: `serial`,
      type: `string`
    },
    createdAt: {
      sql: `created_at`,
      type: `time`
    }
  }
});
