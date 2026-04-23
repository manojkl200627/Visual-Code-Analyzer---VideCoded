import React, { useState, useEffect } from 'react';
import MemoryBlock from './MemoryBlock';

const ExecutionPlayer = ({ steps, activeStepIndex, setActiveStepIndex }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1000); // 1s per step by default

    // Handle Playback
    useEffect(() => {
        let interval;
        if (isPlaying && steps && activeStepIndex < steps.length - 1) {
            interval = setInterval(() => {
                setActiveStepIndex(prev => {
                    const next = prev + 1;
                    if (next >= steps.length - 1) {
                        setIsPlaying(false);
                    }
                    return next;
                });
            }, playbackSpeed);
        }
        return () => clearInterval(interval);
    }, [isPlaying, steps, playbackSpeed, setActiveStepIndex, activeStepIndex]);

    if (!steps || steps.length === 0) {
        return (
            <div className="player-empty">
                <p>Run visualization to see execution state.</p>
            </div>
        );
    }

    const currentStep = steps[activeStepIndex];

    const handlePrev = () => setActiveStepIndex(Math.max(0, activeStepIndex - 1));
    const handleNext = () => setActiveStepIndex(Math.min(steps.length - 1, activeStepIndex + 1));
    const togglePlay = () => {
        if (activeStepIndex >= steps.length - 1 && !isPlaying) {
            setActiveStepIndex(0); // Restart if at end
        }
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="execution-player">
            {/* Top Playback Bar */}
            <div className="playback-bar bg-panel">
                <div className="playback-controls">
                    <button onClick={handlePrev} className="control-btn" disabled={activeStepIndex === 0}>⏮</button>
                    <button onClick={togglePlay} className="control-btn play-btn">{isPlaying ? '⏸' : '▶'} </button>
                    <button onClick={handleNext} className="control-btn" disabled={activeStepIndex === steps.length - 1}>⏭</button>
                    
                    <div className="speed-toggles">
                         <button className={`speed-btn ${playbackSpeed === 1500 ? 'active' : ''}`} onClick={() => setPlaybackSpeed(1500)}>0.5x</button>
                         <button className={`speed-btn ${playbackSpeed === 1000 ? 'active' : ''}`} onClick={() => setPlaybackSpeed(1000)}>1x</button>
                         <button className={`speed-btn ${playbackSpeed === 500 ? 'active' : ''}`} onClick={() => setPlaybackSpeed(500)}>2x</button>
                    </div>
                </div>
                {/* Timeline Scrubber */}
                <div className="timeline-container">
                    <input 
                        type="range" 
                        className="timeline-slider"
                        min="0" 
                        max={steps.length - 1} 
                        value={activeStepIndex} 
                        onChange={(e) => {
                            setActiveStepIndex(Number(e.target.value));
                            setIsPlaying(false);
                        }}
                    />
                </div>
            </div>

            {/* Memory State View */}
            <div className="memory-state-view">
                {(() => {
                    const prevVariables = activeStepIndex > 0 && steps[activeStepIndex - 1]
                        ? steps[activeStepIndex - 1].variables || []
                        : [];
                    const prevMap = Object.fromEntries(prevVariables.map(v => [v.id, v]));

                    return currentStep.variables && currentStep.variables.map(vari => (
                        <MemoryBlock
                            key={vari.id}
                            variable={vari}
                            prevVariable={prevMap[vari.id] || null}
                        />
                    ));
                })()}
            </div>

            {/* Explanation Footer */}
            <div className="explanation-footer bg-panel">
                {currentStep.explanation}
            </div>
        </div>
    );
};

export default ExecutionPlayer;
