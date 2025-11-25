import React, { useEffect, useState } from 'react';
import '../styles/leaders.css';

const LeadersPage = () => {
    const [leaders, setLeaders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/leaders')
            .then(res => res.json())
            .then(data => {
                setLeaders(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    const top1 = leaders[0];
    const top2 = leaders[1];
    const top3 = leaders[2];
    const restList = leaders.slice(3);

    const PodiumItem = ({ user, rank }) => {
        if (!user) return <div className={`podium-item rank-${rank} empty`}></div>;
        
        return (
            <div className={`podium-item rank-${rank}`}>
                <div className="podium-avatar-container">
                    <img 
                        src={user.photo_url || '/images/profile.png'} 
                        alt={user.first_name} 
                        className="podium-avatar"
                        onError={(e) => {e.target.onerror = null; e.target.src="/images/profile.png"}}
                    />
                    {rank === 1 && <div className="crown-3d">👑</div>}
                    <div className="podium-rank-badge">{rank}</div>
                </div>
                
                <div className="podium-info">
                    <div className="podium-name">{user.first_name}</div>
                    <div className="podium-score">
                        <img src="/images/stars.png" alt="" className="star-icon small" />
                        {/* parseInt решает проблему, если число пришло строкой */}
                        <span>{parseInt(user.total_spent || 0).toLocaleString()}</span>
                    </div>
                </div>
                
                <div className="podium-base"></div>
            </div>
        );
    };

    return (
        <main className="leaders-content">
            {isLoading ? (
                <div className="leaders-loading">
                    <div className="spinner"></div>
                </div>
            ) : leaders.length === 0 ? (
                <div className="empty-leaders">Пока пусто</div>
            ) : (
                <>
                    <div className="podium-container">
                        <PodiumItem user={top2} rank={2} />
                        <PodiumItem user={top1} rank={1} />
                        <PodiumItem user={top3} rank={3} />
                    </div>

                    <div className="leaderboard-list">
                        {restList.map((user, i) => {
                            const rank = i + 4;
                            return (
                                <div key={i} className="list-item" style={{animationDelay: `${i * 0.1}s`}}>
                                    <div className="list-rank">#{rank}</div>
                                    <div className="list-avatar-wrapper">
                                        <img 
                                            src={user.photo_url || '/images/profile.png'} 
                                            alt="" 
                                            onError={(e) => {e.target.onerror = null; e.target.src="/images/profile.png"}}
                                        />
                                    </div>
                                    <div className="list-name">{user.first_name}</div>
                                    <div className="list-score">
                                        <img src="/images/stars.png" alt="" className="star-icon small" />
                                        <span>{parseInt(user.total_spent || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </main>
    );
};

export default LeadersPage;
