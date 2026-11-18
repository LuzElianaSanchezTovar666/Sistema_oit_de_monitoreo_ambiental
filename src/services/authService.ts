import { UserRole, Usuario } from '../types/iot';

export type BackendRole = 'Administrador' | 'Operador' | 'Técnico' | 'Supervisor';

export interface BackendUserProfile {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: BackendRole;
  estado: 'activo' | 'inactivo';
  fecha_creacion?: string | null;
  fecha_actualizacion?: string | null;
}

export interface LoginResult {
  user: Usuario;
  backendRole: BackendRole;
  message: string;
}

const ROLE_MAP: Record<BackendRole, UserRole> = {
  Administrador: 'admin',
  Operador: 'cliente',
  Técnico: 'tecnico',
  Supervisor: 'supervisor',
};

const ROLE_CARGO: Record<BackendRole, string> = {
  Administrador: 'Administrador del Sistema',
  Operador: 'Operador de Monitoreo',
  Técnico: 'Técnico de Mantenimiento IoT',
  Supervisor: 'Supervisor de Operaciones',
};

export function mapBackendUser(profile: BackendUserProfile): Usuario {
  return {
    id_usuario: String(profile.id_usuario),
    nombre: profile.nombre,
    correo: profile.correo,
    rol: ROLE_MAP[profile.rol] || 'cliente',
    cargo: ROLE_CARGO[profile.rol] || profile.rol,
    empresa: 'SIMOA · Plataforma IoT',
    fecha_registro: profile.fecha_creacion || new Date().toISOString(),
  };
}

function getCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=')[1] || '') : '';
}

export function getDefaultTabForRole(role: UserRole): string {
  switch (role) {
    case 'tecnico':
      return 'devices';
    case 'supervisor':
    case 'admin':
    case 'cliente':
    default:
      return 'dashboard';
  }
}

export async function loginWithCredentials(
  correo: string,
  password: string
): Promise<LoginResult> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correo.trim(), password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'No fue posible iniciar sesión.');
  }

  return {
    user: mapBackendUser(data.user as BackendUserProfile),
    backendRole: (data.user as BackendUserProfile).rol,
    message: data.message || 'Autenticación exitosa',
  };
}

export async function fetchCurrentUser(): Promise<Usuario | null> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const profile = (await response.json()) as BackendUserProfile;
    return mapBackendUser(profile);
  } catch {
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  const csrfToken = getCookie('simoa_csrf');
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
  }).catch(() => {});
}
