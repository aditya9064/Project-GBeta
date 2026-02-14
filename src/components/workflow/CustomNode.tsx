import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { WorkflowNode } from './WorkflowBuilder';
import { Bell, Cloud, Database, Zap, Brain, HelpCircle } from 'lucide-react';

interface CustomNodeProps {
  data: WorkflowNode['data'];
  selected?: boolean;
}

const DefaultIcon = ({ type }: { type: string }) => {
  const size = 18;
  switch (type) {
    case 'trigger': return <Bell size={size} />;
    case 'app': return <Cloud size={size} />;
    case 'knowledge': return <Database size={size} />;
    case 'action': return <Zap size={size} />;
    case 'ai': return <Brain size={size} />;
    default: return <HelpCircle size={size} />;
  }
};

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

  const nodeColor = getNodeColor();

  return (
    <div
      className={`custom-node ${selected ? 'selected' : ''}`}
      style={{
        borderColor: nodeColor,
      }}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />
      
      <div className="custom-node-content">
        <div
          className="custom-node-icon"
          style={{
            color: nodeColor,
            background: `${nodeColor}20`,
          }}
        >
          {data.icon || <DefaultIcon type={data.type} />}
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
