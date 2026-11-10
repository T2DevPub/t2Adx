import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
export default async function Home() { redirect(await isAdmin() ? '/dashboard' : '/login'); }
