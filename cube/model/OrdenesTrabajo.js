cube('OrdenesTrabajo', {
  sql: `SELECT * FROM ordenes_trabajo WHERE deleted_at IS NULL`,
  
  joins: {
    Companies: {
      sql: `${CUBE}.empresa_id = ${Companies}.id`,
      relationship: `belongsTo`
    },
    Equipos: {
      sql: `${CUBE}.equipo_id = ${Equipos}.id`,
      relationship: `belongsTo`
    }
  },

  measures: {
    count: {
      type: `count`,
      drillMembers: [id, consecutivo, tipoMantenimiento, estado, createdAt]
    }
  },
  
  dimensions: {
    id: {
      sql: `id`,
      type: `string`,
      primaryKey: true
    },
    consecutivo: {
      sql: `consecutivo`,
      type: `string`
    },
    tipoMantenimiento: {
      sql: `tipo_mantenimiento`,
      type: `string`
    },
    estado: {
      sql: `estado`,
      type: `string`
    },
    responsable: {
      sql: `responsable`,
      type: `string`
    },
    createdAt: {
      sql: `created_at`,
      type: `time`
    }
  }
});
