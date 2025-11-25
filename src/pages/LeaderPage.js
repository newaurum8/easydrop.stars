import React, { useEffect, useState } from 'react';
import '../styles/leaders.css';

const LeadersPage = () => {
    const [leaders, setLeaders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Загружаем данные с сервера
        fetch('/api/leaders')
            .then(res => res.json())
            .then(data => {
                setLeaders(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Ошибка загрузки рейтинга:", err);
                setIsLoading(false);
            });
    }, []);

    // Функция для получения иконки ранга (1, 2, 3 место)
    const getRankIcon = (index) => {
        if (index === 0) return <img src="/images/gold-medal.png" alt="1" className="medal-icon" />;
        if (index === 1) return <img src="/images/silver-medal.png" alt="2" className="medal-icon" />;
        if (index === 2) return <img src="/images/bronze-medal.png" alt="3" className="medal-icon" />;
        return <span className="rank-number">#{index + 1}</span>;
    };

    return (
        <main className="leaders-content">
            <div className="leaders-header">
                <h2>Топ 10 Лидеров</h2>
                <p>Потрачено звезд за всё время</p>
            </div>

            {isLoading ? (
                <div className="leaders-loading">Загрузка...</div>
            ) : (
                <div className="leaderboard-list">
                    {leaders.length > 0 ? (
                        leaders.map((user, index) => (
                            <div 
                                key={index} 
                                className={`leader-card rank-${index + 1}`}
                                style={{animationDelay: `${index * 0.1}s`}} // Каскадная анимация
                            >
                                {/* Левая часть: Место и Аватар */}
                                <div className="leader-left">
                                    <div className="rank-wrapper">
                                        {getRankIcon(index)}
                                    </div>
                                    <div className="avatar-wrapper">
                                        <img 
                                            src={user.photo_url || '/images/profile.png'} 
                                            alt={user.first_name} 
                                            className="leader-avatar"
                                            onError={(e) => {e.target.onerror = null; e.target.src="/images/profile.png"}}
                                        />
                                        {/* Корона для топ 1 */}
                                        {index === 0 && <div className="crown-icon">👑</div>}
                                    </div>
                                    <div className="user-info">
                                        <div className="user-name">{user.first_name || 'Аноним'}</div>
                                    </div>
                                </div>

                                {/* Правая часть: Сумма */}
                                <div className="leader-right">
                                    <div className="score-badge">
                                        <img src="/images/stars.png" alt="" className="star-icon small" />
                                        {/* Вывод потраченного (total_spent) */}
                                        <span>{(user.total_spent || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="empty-leaders">Список пока пуст</div>
                    )}
                </div>
            )}
        </main>
    );
};

export default LeadersPage;
