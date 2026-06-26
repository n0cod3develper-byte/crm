const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error en la petición');
  }
  return data;
}

export const rolesService = {
  async fetchRoles() {
    const res = await request('/admin/roles');
    return res.data || res; // Soporta el formato viejo (array directo) y el nuevo { data: array }
  },

  async fetchRolDetalle(id) {
    const res = await request(`/admin/roles/${id}`);
    return res.data || res;
  },

  async crearRol(rolData) {
    return request('/admin/roles', {
      method: 'POST',
      body: JSON.stringify(rolData),
    });
  },

  async actualizarRol(id, rolData) {
    return request(`/admin/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rolData),
    });
  },

  async eliminarRol(id) {
    return request(`/admin/roles/${id}`, {
      method: 'DELETE',
    });
  },

  async guardarPermisos(id, permisos, ejecutadoPor) {
    return request(`/admin/roles/${id}/permisos`, {
      method: 'PUT',
      body: JSON.stringify({ permisos, ejecutado_por: ejecutadoPor }),
    });
  }
};
