import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import SummonersPage from './pages/Summoners'
import PoolPage from './pages/Pool'
import MatchPage from './pages/Match'
import SyncPage from './pages/Sync'
import StatsPage from './pages/Stats'
import MatchesPage from './pages/Matches'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SummonersPage />} />
        <Route path="/pool" element={<PoolPage />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </Layout>
  )
}
