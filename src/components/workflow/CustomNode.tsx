import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { WorkflowNode } from './WorkflowBuilder';

interface CustomNodeProps {
  data: WorkflowNode['data'];
  selected?: boolean;
}

export const CustomNode = memo(({ data, selected }: CustomNodeProps) => {
  const getNodeColor = () => {
    switch (data.type) {
      case 'trigger':
        return '#3B82F6';
      case 'app':
        return '#10B981';
      case 'knowledge':
        return '#8B5CF6';
      case 'action':
        return '#F59E0B';
      case 'ai':
        return '#EC4899';
      default:
        return '#6B7280';
    }
  };

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''}`}
      style={{
        borderColor: getNodeColor(),
      }}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />
      
      <div className="custom-node-content">
        <div className="custom-node-icon" style={{ color: getNodeColor() }}>
          {data.icon}
        </div>
        <div className="custom-node-info">
          <div className="custom-node-label">{data.label}</div>
          {data.description && (
            <div className="custom-node-description">{data.description}</div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

