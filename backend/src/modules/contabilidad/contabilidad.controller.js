import {
  parsearArchivo,
  importarPeriodo,
  obtenerReporte,
  listarPeriodos,
  obtenerCatalogoCuentas,
  listarRubros,
  asignarMapeoCuenta,
  generarPlantillaExcel,
  generarPlantillaCsv
} from './contabilidad.service.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';

export const importarController = async (req, res, next) => {
  let fileToClean = null;
  try {
    const { anio, mes } = req.body;
    const file = req.file;
    const usuarioId = req.userId;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'Debe especificar anio y mes' });
    }
    if (!file) {
      return res.status(400).json({ error: 'Debe adjuntar un archivo válido (.xlsx, .xls, .csv, .tsv, .txt)' });
    }
    
    fileToClean = file.path;

    const { cuentas, movimientos } = await parsearArchivo(file.path, file.originalname);
    
    if (!movimientos || movimientos.length === 0) {
      return res.status(400).json({ error: 'El archivo no contiene filas de movimientos contables válidas.' });
    }

    const periodoId = await importarPeriodo(Number(anio), Number(mes), cuentas, movimientos, usuarioId);

    // Clean up
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
      fileToClean = null;
    }

    res.json({ 
      success: true, 
      periodoId, 
      message: `Importación exitosa: ${movimientos.length} cuentas procesadas.` 
    });
  } catch (error) {
    if (fileToClean && fs.existsSync(fileToClean)) {
      try { fs.unlinkSync(fileToClean); } catch {}
    }
    logger.error('Error en importarController:', error);
    res.status(400).json({ error: error.message || 'Error importando el archivo' });
  }
};

export const descargarPlantillaController = async (req, res, next) => {
  try {
    const { formato = 'excel' } = req.query;

    if (formato === 'csv') {
      const csvData = generarPlantillaCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla_libro_mayor.csv"');
      return res.send(csvData);
    }

    // Por defecto Excel .xlsx
    const buffer = await generarPlantillaExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_libro_mayor.xlsx"');
    res.send(buffer);
  } catch (error) {
    logger.error('Error descargando plantilla:', error);
    res.status(500).json({ error: 'Error al generar la plantilla de ejemplo' });
  }
};

export const getPeriodosController = async (req, res, next) => {
  try {
    const periodos = await listarPeriodos();
    res.json(periodos);
  } catch (error) {
    next(error);
  }
};

export const getReporteController = async (req, res, next) => {
  try {
    const { periodoId, tipoReporte } = req.query; // tipoReporte: BALANCE o ESTADO_RESULTADOS
    if (!periodoId || !tipoReporte) {
      return res.status(400).json({ error: 'Faltan parámetros periodoId o tipoReporte' });
    }
    const reporte = await obtenerReporte(periodoId, tipoReporte);
    res.json(reporte);
  } catch (error) {
    next(error);
  }
};

export const getCuentasController = async (req, res, next) => {
  try {
    const cuentas = await obtenerCatalogoCuentas();
    res.json(cuentas);
  } catch (error) {
    next(error);
  }
};

export const getRubrosController = async (req, res, next) => {
  try {
    const rubros = await listarRubros();
    res.json(rubros);
  } catch (error) {
    next(error);
  }
};

export const putMapeoController = async (req, res, next) => {
  try {
    const { codigo } = req.params;
    const { rubroId } = req.body;
    
    if (!rubroId) {
       return res.status(400).json({ error: 'rubroId es requerido' });
    }
    
    const mapeo = await asignarMapeoCuenta(codigo, rubroId);
    res.json(mapeo);
  } catch (error) {
    next(error);
  }
};
