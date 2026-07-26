'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { Home, StatsReport } from 'iconoir-react';
import { usePathname, useRouter } from 'next/navigation';

type Tab = { value: string; href: string; label: string };

/** Two primary surfaces — the dead Wallet/Profile tabs from the template are gone. */
const TABS: readonly Tab[] = [
  { value: 'home', href: '/home', label: 'Mandate' },
  { value: 'spending', href: '/spending', label: 'Spending' },
];

export const Navigation = () => {
  const router = useRouter();
  const pathname = usePathname();

  const active = TABS.find((tab) => pathname.startsWith(tab.href))?.value ?? 'home';

  const onValueChange = (value: string) => {
    // Tabs is a Radix toggle group underneath: pressing the selected item again emits
    // an empty string. Navigating on that would push a route that does not exist.
    const next = TABS.find((tab) => tab.value === value);
    if (next && next.value !== active) router.push(next.href);
  };

  return (
    <Tabs value={active} onValueChange={onValueChange}>
      <TabItem value="home" icon={<Home />} label="Mandate" />
      <TabItem value="spending" icon={<StatsReport />} label="Spending" />
    </Tabs>
  );
};
