cube('Inventario', {
  sql: `SELECT * FROM inventario`,

  measures: {
    count: {
      type: `count`,
      drillMembers: [id, name, sku]
    },
    totalStockValue: {
      sql: `stock_actual * costo_reposicion`,
      type: `sum`,
      format: `currency`
    },
    totalItemsInStock: {
      sql: `stock_actual`,
      type: `sum`
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
    sku: {
      sql: `sku`,
      type: `string`
    },
    isActive: {
      sql: `is_active`,
      type: `boolean`
    },
    createdAt: {
      sql: `created_at`,
      type: `time`
    }
  }
});
