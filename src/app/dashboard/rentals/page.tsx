import { redirect } from 'next/navigation'

// Rental dashboard is now merged into the main dashboard
// which auto-detects business type from features
export default function RentalDashboardPage() {
  redirect('/dashboard')
}
