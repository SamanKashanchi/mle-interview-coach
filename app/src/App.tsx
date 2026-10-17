import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isMock } from './lib/db'
import { AuthProvider, RedirectIfSignedIn, RequireAuth, RequireSetup } from './lib/auth'
import Layout from './pages/Layout'
import SignIn from './pages/signin/SignIn'
import Onboarding from './pages/onboarding/Onboarding'
import Today from './pages/today/Today'
import QuestionPage from './pages/question/QuestionPage'
import Plan from './pages/plan/Plan'
import History from './pages/history/History'
import DayPage from './pages/history/DayPage'
import Targets from './pages/targets/Targets'
import Research from './pages/research/Research'
import ProfilePage from './pages/profile/ProfilePage'

// Mock builds use hash URLs so they work from any static host, including a preview link.
const Router = isMock ? HashRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route element={<RedirectIfSignedIn />}>
            <Route path="/signin" element={<SignIn />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<RequireSetup />}>
              <Route element={<Layout />}>
                <Route index element={<Today />} />
                <Route path="questions/:id" element={<QuestionPage />} />
                <Route path="history" element={<History />} />
                <Route path="history/:date" element={<DayPage />} />
                <Route path="plan" element={<Plan />} />
                <Route path="targets" element={<Targets />} />
                <Route path="targets/:id" element={<Research />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}
