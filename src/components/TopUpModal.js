import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';

const TopUpModal = () => {
    const { closeTopUpModal, updateBalance, user } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('stars');
    const [starsAmount, setStarsAmount] = useState(500);
    const [tonAmount, setTonAmount] = useState(0.1);
    const [tonRate] = useState(140); // Примерный курс

    useEffect(() => {
        if (activeTab === 'stars') {
            setTonAmount(0.1);
        } else {
            setStarsAmount(500);
        }
    }, [activeTab]);

    const handleStarsChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setStarsAmount(isNaN(value) ? 0 : value);
    };

    const handleTonChange = (e) => {
        const value = parseFloat(e.target.value);
        setTonAmount(isNaN(value) ? 0 : value);
    };

    const handleTopUpStars = async () => {
        if (starsAmount <= 0 || !user) {
            alert('Пожалуйста, введите корректное количество звезд.');
            return;
        }

        try {
            const response = await fetch('/api/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    firstName: user.firstName,
                    username: user.username,
                    photoUrl: user.photoUrl,
                    amount: starsAmount,
                }),
            });

            if (!response.ok) {
                throw new Error('Ошибка ответа сервера');
            }

            updateBalance(starsAmount);
            alert(`${starsAmount.toLocaleString()} звезд успешно зачислено!`);
            closeTopUpModal();

        } catch (error) {
            console.error('Ошибка при пополнении:', error);
            alert('Произошла ошибка. Попробуйте снова.');
        }
    };

    const handleConnectWallet = () => {
        alert('Логика подключения кошелька в разработке...');
    };
    
    const handleTopUpTon = () => {
        alert('Пополнение через TON временно недоступно.');
    };

    const calculatedStars = Math.floor(tonAmount * tonRate);
    const bonusStars = Math.floor(calculatedStars * 0.1);

    return (
        <div className="top-up-modal">
            <div className="top-up-modal-content">
                <button onClick={closeTopUpModal} className="close-modal-btn">&times;</button>
                <h2>Top Up Balance</h2>
                <div className="top-up-tabs">
                    <button 
                        className={`top-up-tab ${activeTab === 'stars' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stars')}
                    >
                        <img src="/images/stars.png" alt="Stars" className="star-icon small" />
                        Stars
                    </button>
                    <button 
                        className={`top-up-tab ${activeTab === 'ton' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ton')}
                    >
                        <img src="/images/ton.png" alt="TON" className="star-icon small" />
                        TON
                        <span className="ton-bonus">+10%</span>
                    </button>
                </div>

                {activeTab === 'stars' && (
                    <div className="tab-panel">
                        <label htmlFor="stars-amount">Enter amount</label>
                        <input 
                            id="stars-amount"
                            type="number" 
                            value={starsAmount}
                            onChange={handleStarsChange} 
                            placeholder="500" 
                        />
                        <button className="top-up-action-btn" onClick={handleTopUpStars}>
                            Top up with Stars
                        </button>
                    </div>
                )}

                {activeTab === 'ton' && (
                     <div className="tab-panel">
                        <button className="top-up-action-btn connect-wallet-btn" onClick={handleConnectWallet}>
                            <img src="/images/ton.png" alt="TON" className="star-icon small" />
                            Connect Wallet
                        </button>
                        <label htmlFor="ton-amount">Enter amount</label>
                         <input 
                            id="ton-amount"
                            type="number" 
                            step="0.1"
                            value={tonAmount} 
                            onChange={handleTonChange}
                            placeholder="0.1"
                        />
                        <div className="ton-calculation">
                           ≈{calculatedStars.toLocaleString()} stars + {bonusStars.toLocaleString()} bonus stars
                        </div>
                        <button className="top-up-action-btn" onClick={handleTopUpTon}>
                            Top up with TON
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopUpModal;