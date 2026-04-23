import React from 'react';
import Editor from '@monaco-editor/react';

// UNCONTROLLED editor - no value prop, Monaco owns the content
// We expose getCode() via ref so parent can read it on button click
const CodeEditor = ({ language, editorRef }) => {
    const handleMount = (editor) => {
        editorRef.current = editor; // store Monaco instance in parent ref
    };

    return (
        <Editor
            height="100%"
            width="100%"
            defaultLanguage="javascript"
            language={language}
            defaultValue=""
            onMount={handleMount}
            theme="light"
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: '"Space Mono", monospace',
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                wordWrap: 'on',
            }}
        />
    );
};

export default CodeEditor;
