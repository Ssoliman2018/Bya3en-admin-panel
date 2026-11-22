'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { z } from 'zod';

import pathsConfig from '~/config/paths.config';

export const updateAdminTeamRoleAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { error } = await client
      .from('admin_team' as never)
      .update({ role_key: data.roleKey } as never)
      .eq('id', data.memberId);
    if (error) throw new Error(error.message);
    revalidatePath(pathsConfig.app.roles);
    return { success: true };
  },
  {
    schema: z.object({
      memberId: z.string().uuid(),
      roleKey: z.string().min(1),
    }),
  },
);
