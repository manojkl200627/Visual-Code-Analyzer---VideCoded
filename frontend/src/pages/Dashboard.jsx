import React, { useState, useRef } from 'react';
import CodeEditor from '../components/CodeEditor';
import ExecutionPlayer from '../components/ExecutionPlayer';
import axios from 'axios';

const Dashboard = () => {
    const editorRef = useRef(null); // holds Monaco editor instance directly
    const [title, setTitle] = useState('');
    const [language, setLanguage] = useState('javascript');

    const [steps, setSteps] = useState([]);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVisualize = async () => {
        // Read directly from Monaco editor instance - guaranteed fresh value
        const code = editorRef.current ? editorRef.current.getValue() : '';

        if (!code || !code.trim()) {
            setError('Please paste some code into the editor first.');
            return;
        }

        setError('');
        setLoading(true);
        setSteps([]);
        setActiveStepIndex(0);

        try {
            const response = await axios.post('http://127.0.0.1:5000/api/analyze', {
                title: title.trim() || 'Code Snippet',
                language,
                code
            });

            const data = response.data;
            if (!data.steps || data.steps.length === 0) {
                setError('No traceable statements detected. Try pasting a function with variables.');
            } else {
                setSteps(data.steps);
                setActiveStepIndex(0);
            }
        } catch (err) {
            console.error(err);
            const backendError = err.response?.data?.error;
            setError(backendError ? `Backend Error: ${backendError}` : 'Could not reach the backend. Make sure the server is running on port 5000.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-layout">
            <div className="left-panel">
                <div className="panel-header">
                    <h1 className="app-title">Visual Code Analyzer</h1>
                    <p className="app-subtitle">Paste any code → click Visualize → watch it run step-by-step.</p>
                </div>

                <div className="top-controls">
                    <input
                        className="input-field"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Snippet title (optional)"
                        style={{ flex: 1 }}
                    />
                    <select
                        className="input-field"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        style={{ width: '130px' }}
                    >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="cpp">C++</option>
                        <option value="java">Java</option>
                    </select>
                </div>

                {error && (
                    <div className="error-banner">{error}</div>
                )}

                <div className="editor-wrapper">
                    <CodeEditor language={language} editorRef={editorRef} />
                </div>

                <button
                    className="btn-primary"
                    onClick={handleVisualize}
                    disabled={loading}
                >
                    {loading ? '⏳ Analyzing...' : '▶  Visualize Code'}
                </button>
            </div>

            <div className="right-panel">
                <ExecutionPlayer
                    steps={steps}
                    activeStepIndex={activeStepIndex}
                    setActiveStepIndex={setActiveStepIndex}
                />
            </div>
        </div>
    );
};

export default Dashboard;
