import React, { useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';

const Visualizer = ({ nodes: initialNodes, edges: initialEdges }) => {
  const [nodes, setNodes] = React.useState(initialNodes);
  const [edges, setEdges] = React.useState(initialEdges);
  const [prevNodesProp, setPrevNodesProp] = React.useState(initialNodes);
  const [prevEdgesProp, setPrevEdgesProp] = React.useState(initialEdges);

  if (initialNodes !== prevNodesProp) {
      setNodes(initialNodes);
      setPrevNodesProp(initialNodes);
  }
  if (initialEdges !== prevEdgesProp) {
      setEdges(initialEdges);
      setPrevEdgesProp(initialEdges);
  }

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  return (
    <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#fff" gap={16} size={1} style={{ backgroundColor: 'transparent' }} />
        <Controls style={{ backgroundColor: '#1e293b', border: 'none', fill: '#fff' }} />
      </ReactFlow>
    </div>
  );
};

export default Visualizer;
