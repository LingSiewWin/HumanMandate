import { auth } from '@/auth';
import { Navigation } from '@/components/Navigation';
import { Page } from '@/components/PageLayout';

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    console.log('Not authenticated');
  }

  return (
    <Page className="hm-app">
      {children}
      <Page.Footer className="px-0 fixed bottom-0 w-full border-t border-[color:var(--hm-line)] bg-[color:var(--hm-bg)]/95 backdrop-blur-sm">
        <Navigation />
      </Page.Footer>
    </Page>
  );
}
