import React, { useState, useEffect } from 'react';

const LeadersPage = () => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                const response = await fetch('/api/leaderboard');
                if (!response.ok) {
                    throw new Error('Не удалось загрузить данные рейтинга');
                }
                const data = await response.json();
                setLeaders(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaders();
    }, []);

    if (loading) {
        return <p style={{ textAlign: 'center', marginTop: '20px' }}>Загрузка рейтинга...</p>;
    }

    if (error) {
        return <p style={{ textAlign: 'center', marginTop: '20px', color: 'red' }}>Ошибка: {error}</p>;
    }

    const getRankClass = (rank) => {
        if (rank === 1) return 'top-1';
        if (rank === 2) return 'top-2';
        if (rank === 3) return 'top-3';
        return '';
    };

    return (
        <main className="leaders-content">
            <h3>Рейтинг</h3>
            {leaders.length > 0 ? (
                <div className="leaderboard">
                    {leaders.map((leader) => (
                        <div key={leader.id} className={`leader-item ${getRankClass(leader.rank)}`}>
                            <div className="leader-rank">
                                {leader.rank <= 3 ? <span className={`rank-icon`}></span> : leader.rank}
                            </div>
                            <div className="leader-info">
                                <img src={leader.avatar} alt="Avatar" className="leader-avatar" />
                                <span className="leader-name">{leader.name}</span>
                            </div>
                            <div className="leader-amount">
                                <img src="/images/stars.png" alt="Star" className="star-icon small" />
                                <span>{leader.amount.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p style={{ textAlign: 'center', marginTop: '20px' }}>В рейтинге пока никого нет.</p>
            )}
        </main>
    );
};

export default LeadersPage;
