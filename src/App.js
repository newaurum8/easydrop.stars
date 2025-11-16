import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UpgradePage from './pages/UpgradePage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/HistoryPage';
import CasePage from './pages/CasePage';
import LeadersPage from './pages/LeaderPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><MainPage /></Layout>} />
        <Route path="/upgrade" element={<Layout><UpgradePage /></Layout>} />
        <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
        <Route path="/history" element={<Layout><HistoryPage /></Layout>} />
        <Route path="/leaders" element={<Layout><LeadersPage /></Layout>} />
        <Route path="/case/:caseId" element={<Layout><CasePage /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;