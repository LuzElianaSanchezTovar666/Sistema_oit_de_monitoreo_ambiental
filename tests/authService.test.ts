import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultTabForRole, mapBackendUser } from '../src/services/authService';

test('mapBackendUser mapea correctamente los 4 roles de RF-01', () => {
  const admin = mapBackendUser({
    id_usuario: 1,
    nombre: 'Admin',
    correo: 'admin@simoa-ejemplo.org',
    rol: 'Administrador',
    estado: 'activo',
  });
  const operador = mapBackendUser({
    id_usuario: 2,
    nombre: 'Operador',
    correo: 'op@simoa-ejemplo.org',
    rol: 'Operador',
    estado: 'activo',
  });
  const tecnico = mapBackendUser({
    id_usuario: 3,
    nombre: 'Técnico',
    correo: 'tec@simoa-ejemplo.org',
    rol: 'Técnico',
    estado: 'activo',
  });
  const supervisor = mapBackendUser({
    id_usuario: 4,
    nombre: 'Supervisor',
    correo: 'sup@simoa-ejemplo.org',
    rol: 'Supervisor',
    estado: 'activo',
  });

  assert.equal(admin.rol, 'admin');
  assert.equal(operador.rol, 'cliente');
  assert.equal(tecnico.rol, 'tecnico');
  assert.equal(supervisor.rol, 'supervisor');
});

test('getDefaultTabForRole redirige al módulo inicial correspondiente', () => {
  assert.equal(getDefaultTabForRole('admin'), 'dashboard');
  assert.equal(getDefaultTabForRole('cliente'), 'dashboard');
  assert.equal(getDefaultTabForRole('supervisor'), 'dashboard');
  assert.equal(getDefaultTabForRole('tecnico'), 'devices');
});
