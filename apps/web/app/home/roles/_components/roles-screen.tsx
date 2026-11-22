'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { KeyRound, Users } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@kit/ui/table';

import { AdminPageHeader } from '../../_components/admin-page-header';
import { updateAdminTeamRoleAction } from '../_lib/server/roles.actions';
import type { loadRolesBundle } from '../_lib/server/roles.loader';

type Bundle = Awaited<ReturnType<typeof loadRolesBundle>>;

const ACCESS_AR: Record<string, string> = {
  edit: 'تعديل',
  view: 'عرض',
  none: '—',
};

const ACCESS_CLASS: Record<string, string> = {
  edit: 'by-st green',
  view: 'by-st blue',
  none: 'text-muted-foreground',
};

export function RolesScreen({ data }: { data: Bundle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setRole(memberId: string, roleKey: string) {
    startTransition(async () => {
      try {
        await updateAdminTeamRoleAction({ memberId, roleKey });
        toast.success('اتحدث دور العضو');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'فشل التحديث');
      }
    });
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="الأدوار والصلاحيات"
        description="كل دور بيشوف الأقسام اللي محتاجها · لوحة التاجر والبيّاع منفصلتين"
        searchPlaceholder="دور على عضو أو دور..."
        stats={[
          {
            label: 'أدوار',
            value: data.roles.length,
            icon: <KeyRound className="size-3.5" />,
          },
          {
            label: 'أعضاء الفريق',
            value: data.team.length,
            icon: <Users className="size-3.5" />,
          },
          {
            label: 'أقسام',
            value: data.sections.length,
            icon: <KeyRound className="size-3.5" />,
          },
          {
            label: 'صلاحيات',
            value: data.perms.length,
            icon: <Users className="size-3.5" />,
          },
        ]}
      />

      <div className="by-card">
        <h2 className="text-[15px] font-bold">مصفوفة الصلاحيات</h2>
        <div className="border-border mt-3 overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">القسم</TableHead>
                {data.roles.map((r) => (
                  <TableHead key={String(r.key)} className="text-right font-bold">
                    {String(r.label_ar).split(' · ')[0]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sections.map((section) => (
                <TableRow key={section.key}>
                  <TableCell className="font-semibold">{section.label}</TableCell>
                  {data.roles.map((role) => {
                    const perm = data.perms.find(
                      (p) =>
                        p.role_key === role.key &&
                        p.section_key === section.key,
                    );
                    const access = String(perm?.access ?? 'none');
                    return (
                      <TableCell key={`${role.key}-${section.key}`}>
                        <span className={ACCESS_CLASS[access]}>
                          {ACCESS_AR[access]}
                        </span>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="by-card">
        <h2 className="text-[15px] font-bold">فريق الإدارة</h2>
        <div className="border-border mt-3 overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F8F7FC] hover:bg-[#F8F7FC]">
                <TableHead className="text-right font-bold">الاسم</TableHead>
                <TableHead className="text-right font-bold">البريد</TableHead>
                <TableHead className="text-right font-bold">الدور</TableHead>
                <TableHead className="text-right font-bold">آخر دخول</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.team.map((member) => (
                <TableRow key={String(member.id)}>
                  <TableCell className="font-bold">
                    {String(member.name)}
                  </TableCell>
                  <TableCell data-numeric>{String(member.email)}</TableCell>
                  <TableCell>
                    <select
                      className="by-fchip"
                      disabled={pending}
                      value={String(member.role_key)}
                      onChange={(e) =>
                        setRole(String(member.id), e.target.value)
                      }
                    >
                      {data.roles.map((role) => (
                        <option key={String(role.key)} value={String(role.key)}>
                          {String(role.label_ar)}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{String(member.last_login_label ?? '—')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="by-note mt-3 !mb-0">
          لوحة التاجر منفصلة: كل تاجر بيشوف بيانات نشاطه بس. البيّاع ماعندوش أي
          وصول للوحة الإدارة أو التجار.
        </p>
      </div>
    </div>
  );
}
