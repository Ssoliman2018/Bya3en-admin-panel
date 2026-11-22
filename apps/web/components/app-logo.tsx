import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@kit/ui/utils';

function LogoMark({
  className,
  variant = 'light',
}: {
  className?: string;
  variant?: 'light' | 'dark';
}) {
  const dark = variant === 'dark';

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5',
        'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
        className,
      )}
    >
      <Image
        src="/images/logo.png"
        alt="بياعين"
        width={36}
        height={36}
        className={cn(
          'by-logo-mark size-9 shrink-0 rounded-[10px] object-contain',
          dark && 'shadow-[0_0_18px_rgba(122,0,255,0.55)]',
        )}
        priority
      />
      <div className="by-logo-wordmark min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
        <div
          className={cn(
            'truncate text-[18px] font-extrabold',
            dark ? 'text-white' : 'text-[#0B0F2E]',
          )}
        >
          بياعين
        </div>
        <div
          className={cn(
            'truncate text-[11px] font-semibold',
            dark ? 'text-[#A7AACB]' : 'text-[#585C78]',
          )}
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Bayya3een
        </div>
      </div>
    </div>
  );
}

export function AppLogo({
  href,
  label,
  className,
  variant = 'light',
}: {
  href?: string | null;
  className?: string;
  label?: string;
  variant?: 'light' | 'dark';
}) {
  if (href === null) {
    return <LogoMark className={className} variant={variant} />;
  }

  return (
    <Link
      aria-label={label ?? 'بياعين | لوحة الإدارة'}
      href={href ?? '/home'}
      className={cn(
        'block min-w-0',
        'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center',
        className,
      )}
    >
      <LogoMark variant={variant} />
    </Link>
  );
}
