import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import UpgradePage from './pages/UpgradePage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/HistoryPage';
import CasePage from './pages/CasePage';
import LeadersPage from './pages/LeaderPage';
import AdminPage from './pages/AdminPage'; // <-- 1. Импортируем новую страницу

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout><MainPage /></Layout>} />
        <Route path="/upgrade" element={<Layout><UpgradePage /></Layout>} />
        <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
        <Route path="/history" element={<Layout><HistoryPage /></Layout>} />
        <Route path="/leaders" element={<Layout><LeadersPage /></Layout>} />
        <Route path="/admin" element={<Layout><AdminPage /></Layout>} /> {/* <-- 2. Добавляем новый роут */}
        <Route path="/case/:caseId" element={<Layout><CasePage /></Layout>} />
      </Routes>
    </Router>
  );
}

export default App;
