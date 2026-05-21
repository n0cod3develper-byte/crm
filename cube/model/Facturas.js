cube('Facturas', {
  sql: `SELECT * FROM facturas`,

  joins: {
    Companies: {
      sql: `${CUBE}.empresa_id = ${Companies}.id`,
      relationship: `belongsTo`
    }
  },

  measures: {
    count: {
      type: `count`,
      drillMembers: [id, consecutivoInterno, numeroFactura, estado]
    },
    totalRevenue: {
      sql: `total`,
      type: `sum`,
      format: `currency`
    },
    totalIVA: {
      sql: `iva_valor`,
      type: `sum`,
      format: `currency`
    }
  },

  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true
    },
    consecutivoInterno: {
      sql: `consecutivo_interno`,
      type: `string`
    },
    numeroFactura: {
      sql: `numero_factura`,
      type: `string`
    },
    estado: {
      sql: `estado`,
      type: `string`
    },
    createdAt: {
      sql: `created_at`,
      type: `time`
    },
    fechaFactura: {
      sql: `fecha_factura`,
      type: `time`
    }
  }
});
