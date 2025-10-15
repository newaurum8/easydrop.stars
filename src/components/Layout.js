import React, { useContext } from 'react';
import Header from './Header';
import BottomNav from './BottomNav';
import { AppContext } from '../context/AppContext';
import TopUpModal from './TopUpModal'; // <-- 1. Импортируйте новый компонент

const Layout = ({ children }) => {
    // 2. Получите состояние модального окна из контекста
    const { isTopUpModalOpen } = useContext(AppContext);

    return (
        <div className="app-container">
            <Header />
            <main>{children}</main>
            <BottomNav />
            {/* 3. Отобразите модальное окно, если isTopUpModalOpen === true */}
            {isTopUpModalOpen && <TopUpModal />}
        </div>
    );
};

export default Layout;