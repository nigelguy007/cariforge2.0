// showed now lives on /missions ("Projects"): the open-brief bridge, the
// Start-a-project action and the project list. Bookmarks keep working.
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect('/missions');
}
