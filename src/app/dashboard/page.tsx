import { redirect } from 'next/navigation'; import { isAdmin } from '@/lib/auth'; import Dashboard from './ui';
export default async function DashboardPage(){if(!await isAdmin())redirect('/login');return <Dashboard/>;}
