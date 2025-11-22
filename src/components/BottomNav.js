// src/components/BottomNav.js
import React from 'react';
import { NavLink } from 'react-router-dom';

const BottomNav = () => {
    return (
        <nav className="bottom-nav">
            <NavLink to="/" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")} end>
                <img src="/images/home.png" alt="Главная" className="nav-icon" />
                <span className="nav-label">Главная</span>
            </NavLink>
            <NavLink to="/upgrade" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                <img src="/images/upgrade.png" alt="Апгрейд" className="nav-icon" />
                <span className="nav-label">Апгрейд</span>
            </NavLink>
            <NavLink to="/leaders" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                 <img src="/images/rank.png" alt="Рейтинг" className="nav-icon" />
                <span className="nav-label">Рейтинг</span>
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                 <img src="/images/profile.png" alt="Профиль" className="nav-icon" />
                <span className="nav-label">Профиль</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                <img src="/images/history.png" alt="История" className="nav-icon" />
                <span className="nav-label">История</span>
            </NavLink>
        </nav>
    );
};

export default BottomNav;
