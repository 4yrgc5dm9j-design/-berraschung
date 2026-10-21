import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui'
import TodayPage from '@/features/today/TodayPage'

const DiscoverPage = lazy(() => import('@/features/discover/DiscoverPage'))
const CollectionsPage = lazy(() => import('@/features/collections/CollectionsPage'))
const PlanPage = lazy(() => import('@/features/plan/PlanPage'))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'))
const SharePage = lazy(() => import('@/features/collections/SharePage'))

const page = (el: React.ReactNode) => (
  <Suspense
    fallback={
      <div className="grid h-[60vh] place-items-center">
        <Spinner />
      </div>
    }
  >
    {el}
  </Suspense>
)

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'entdecken/:tab?', element: page(<DiscoverPage />) },
      { path: 'sammlungen/:id?', element: page(<CollectionsPage />) },
      { path: 'planen/:tab?', element: page(<PlanPage />) },
      { path: 'profil', element: page(<ProfilePage />) },
      { path: 'teilen', element: page(<SharePage />) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
