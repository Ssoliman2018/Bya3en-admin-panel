import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function loadRolesBundle() {
  const client = getSupabaseServerClient();

  const [rolesRes, permsRes, teamRes] = await Promise.all([
    client.from('admin_roles' as never).select('*').order('sort_order'),
    client.from('admin_role_permissions' as never).select('*'),
    client.from('admin_team' as never).select('*').order('name'),
  ]);

  if (rolesRes.error) throw rolesRes.error;
  if (permsRes.error) throw permsRes.error;
  if (teamRes.error) throw teamRes.error;

  const roles = (rolesRes.data as unknown as Array<Record<string, unknown>>) ?? [];
  const perms =
    (permsRes.data as unknown as Array<Record<string, unknown>>) ?? [];
  const team = (teamRes.data as unknown as Array<Record<string, unknown>>) ?? [];

  const sections = [
    ...new Map(
      perms.map((p) => [
        String(p.section_key),
        String(p.section_label_ar),
      ]),
    ),
  ].map(([key, label]) => ({ key, label }));

  return { roles, perms, team, sections };
}
