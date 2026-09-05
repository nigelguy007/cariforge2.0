import type { ReactNode } from 'react';
import { AppShell } from '@/components/custom/app/app-shell';

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
