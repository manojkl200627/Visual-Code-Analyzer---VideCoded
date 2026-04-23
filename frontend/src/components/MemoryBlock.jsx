import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Infer Python-style type
function inferType(value, isArray) {
    if (isArray) return `list[${value.length}]`;
    if (value === 'True' || value === 'False') return 'bool';
    if (value === 'None') return 'NoneType';
    if (!isNaN(Number(value)) && value !== '') {
        return Number.isInteger(Number(value)) ? 'int' : 'float';
    }
    return 'str';
}

// Rich multi-line tooltip card using React Portal
const TooltipCard = ({ lines, children }) => {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const targetRef = useRef(null);

    useEffect(() => {
        if (visible && targetRef.current) {
            const rect = targetRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 10,
                left: rect.left + rect.width / 2
            });
        }
    }, [visible]);

    return (
        <div
            ref={targetRef}
            style={{ display: 'inline-block' }}
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && createPortal(
                <div style={{
                    position: 'fixed',
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    transform: 'translateX(-50%)',
                    minWidth: '220px',
                    background: '#ffffff',
                    border: '1px solid #f97316', /* orange-500 */
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(249, 115, 22, 0.2)', /* softer orange shadow */
                    zIndex: 999999,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                }}>
                    {/* Header */}
                    <div style={{
                        background: 'linear-gradient(90deg, #ffedd5, #fff7ed)', /* light orange */
                        padding: '6px 12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#c2410c', /* orange-700 */
                        fontFamily: '"Space Mono", monospace',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #fed7aa', /* orange-200 */
                    }}>
                        {lines[0]}
                    </div>
                    {/* Body rows */}
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {lines.slice(1).map((line, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '16px',
                                fontSize: '0.72rem',
                                fontFamily: '"Space Mono", monospace',
                                color: '#475569', /* slate-600 */
                                borderBottom: i < lines.length - 2 ? '1px solid #e2e8f0' : 'none', /* slate-200 */
                                paddingBottom: i < lines.length - 2 ? '5px' : '0',
                            }}>
                                <span style={{ color: '#64748b' }}>{line.key}</span>
                                <span style={{ color: '#0f172a', fontWeight: 600 }}>{line.value}</span>
                            </div>
                        ))}
                    </div>
                    {/* Arrow pointing UP */}
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderBottom: '6px solid #f97316', /* orange-500 */
                    }} />
                </div>,
                document.body
            )}
        </div>
    );
};

const MemoryBlock = ({ variable, prevVariable }) => {
    if (!variable) return null;

    const type = variable.type || 'variable';
    const value = variable.value;
    const label = variable.label || variable.id;

    // ── Array View ──────────────────────────────────────────────────────────
    if (type === 'array' || Array.isArray(value)) {
        const items = Array.isArray(value) ? value : [value];
        const prevItems = prevVariable && Array.isArray(prevVariable.value) ? prevVariable.value : [];

        return (
            <div className="memory-block-container">
                <div className="memory-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{label}</span>
                    <span style={{ color: '#475569', fontWeight: 400 }}>
                        list · len={items.length}
                    </span>
                </div>
                <div className="array-grid">
                    {items.map((item, index) => {
                        const isHighlighted = variable.highlights && variable.highlights.includes(index);
                        const changed = prevItems[index] !== undefined && String(prevItems[index]) !== String(item);
                        const elemType = inferType(String(item), false);

                        const tooltipLines = [
                            `${label}[${index}]`,
                            { key: 'Value', value: String(item) },
                            { key: 'Index', value: String(index) },
                            { key: 'Type', value: elemType },
                            { key: 'Array length', value: String(items.length) },
                            { key: 'Changed', value: changed ? `Yes  (was ${prevItems[index]})` : 'No' },
                        ];

                        return (
                            <div key={index} className="array-column">
                                <TooltipCard lines={tooltipLines}>
                                    <div
                                        className={`array-cell ${isHighlighted ? 'highlighted' : ''}`}
                                        style={{
                                            cursor: 'help',
                                            outline: changed ? '2px solid #f59e0b' : 'none',
                                            transition: 'outline 0.2s',
                                        }}
                                    >
                                        {String(item)}
                                    </div>
                                </TooltipCard>
                                <div className="array-index">{index}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Variable View ────────────────────────────────────────────────────────
    const strVal = String(value ?? '');
    const elemType = inferType(strVal, false);
    const prevVal = prevVariable ? String(prevVariable.value ?? '') : null;
    const changed = prevVal !== null && prevVal !== strVal;
    const numVal = Number(strVal);
    const prevNumVal = prevVal !== null ? Number(prevVal) : null;
    const delta = changed && !isNaN(numVal) && !isNaN(prevNumVal)
        ? (numVal - prevNumVal)
        : null;

    const tooltipLines = [
        `${label}`,
        { key: 'Value', value: strVal },
        { key: 'Type', value: elemType },
        ...(changed ? [{ key: 'Previous', value: prevVal }] : []),
        ...(delta !== null ? [{ key: 'Δ Change', value: delta > 0 ? `+${delta}` : String(delta) }] : []),
        { key: 'Changed this step', value: changed ? 'Yes ✓' : 'No' },
        ...(elemType === 'str' ? [{ key: 'Length', value: `${strVal.length} chars` }] : []),
        ...(elemType === 'int' || elemType === 'float'
            ? [{ key: 'Binary', value: (numVal >>> 0).toString(2).padStart(8, '0') }]
            : []),
    ];

    return (
        <div className="memory-block-container">
            <div className="memory-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{label}</span>
                <span style={{ color: '#475569', fontWeight: 400 }}>{elemType}</span>
            </div>
            <TooltipCard lines={tooltipLines}>
                <div
                    className="variable-box"
                    style={{
                        cursor: 'help',
                        outline: changed ? '2px solid #f59e0b' : 'none',
                        transition: 'outline 0.2s',
                    }}
                >
                    {strVal}
                </div>
            </TooltipCard>
        </div>
    );
};

export default MemoryBlock;
