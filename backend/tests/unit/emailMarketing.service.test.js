import { compilarPlantilla, reescribirLinks, excluirContactosNoAptos } from '../../src/modules/email-marketing/email-marketing.service.js';

describe('Servicio de Email Marketing', () => {

  describe('compilarPlantilla', () => {
    it('debe reemplazar las variables dinámicas de Handlebars correctamente', () => {
      const plantilla = '<p>Hola {{nombre}}, tu correo es {{correo}} de la empresa {{empresa}}</p>';
      const contacto = {
        nombre: 'Juan Pérez',
        correo: 'juan@perez.com',
        empresa_nombre: 'Logística SAS',
        unsubscribe_token: 'token123'
      };
      const envioId = 'envio123';

      const resultado = compilarPlantilla(plantilla, contacto, envioId);

      expect(resultado).toContain('Hola Juan Pérez');
      expect(resultado).toContain('tu correo es juan@perez.com');
      expect(resultado).toContain('de la empresa Logística SAS');
    });

    it('debe inyectar el pixel de tracking de apertura', () => {
      const plantilla = '<body>Contenido del correo</body>';
      const contacto = { nombre: 'Juan', unsubscribe_token: 'token123' };
      const envioId = 'envio123';

      const resultado = compilarPlantilla(plantilla, contacto, envioId);

      expect(resultado).toContain('api/email-marketing/track/open/envio123');
    });

    it('debe inyectar el enlace de unsubscribe al pie', () => {
      const plantilla = '<p>Contenido</p>';
      const contacto = { nombre: 'Juan', unsubscribe_token: 'token123' };
      const envioId = 'envio123';

      const resultado = compilarPlantilla(plantilla, contacto, envioId);

      expect(resultado).toContain('api/email-marketing/unsubscribe/token123');
    });
  });

  describe('reescribirLinks', () => {
    it('debe reescribir enlaces externos para el tracking de clics', () => {
      const html = '<a href="https://google.com">Buscar</a>';
      const envioId = 'envio123';
      const baseUrl = 'http://localhost:4000';

      const resultado = reescribirLinks(html, envioId, baseUrl);

      expect(resultado).toContain('api/email-marketing/track/click/envio123?url=https%3A%2F%2Fgoogle.com');
    });

    it('no debe reescribir enlaces del sistema o de desuscripción', () => {
      const html = '<a href="http://localhost:4000/api/email-marketing/unsubscribe/token123">Baja</a>';
      const envioId = 'envio123';
      const baseUrl = 'http://localhost:4000';

      const resultado = reescribirLinks(html, envioId, baseUrl);

      expect(resultado).toBe(html);
    });
  });

  describe('excluirContactosNoAptos', () => {
    it('debe filtrar contactos dados de baja o rebotados', () => {
      const contactos = [
        { correo: 'activo@test.com', estado: 'activo' },
        { correo: 'baja@test.com', estado: 'baja' },
        { correo: 'rebotado@test.com', estado: 'rebotado' },
      ];

      const aptos = excluirContactosNoAptos(contactos);

      expect(aptos).toHaveLength(1);
      expect(aptos[0].correo).toBe('activo@test.com');
    });
  });

});
