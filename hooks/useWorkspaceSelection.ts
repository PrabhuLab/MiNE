import { useRef, useState } from 'react';
import { useStore } from '@/store/useStore';
import type { GraphFocusRequest } from '@/services/workspace/types';

export function useWorkspaceSelection() {
  const setSelectedElement = useStore((state) => state.setSelectedElement);
  const [activeTab, setActiveTab] = useState<'graph' | 'data'>('graph');
  const [dataTab, setDataTab] = useState<'nodes' | 'edges' | 'modularity'>('nodes');
  const [graphFocusRequest, setGraphFocusRequest] = useState<GraphFocusRequest | null>(null);
  const focusRequestIdRef = useRef(0);

  const handleElementDoubleClick = (
    id: string,
    type: 'node' | 'edge',
    endpoints?: { source: string; target: string },
  ) => {
    setSelectedElement(id);
    if (activeTab === 'data') {
      focusRequestIdRef.current += 1;
      setGraphFocusRequest({
        id,
        type,
        requestId: focusRequestIdRef.current,
        source: endpoints?.source,
        target: endpoints?.target,
      });
      setActiveTab('graph');
    } else {
      setActiveTab('data');
      setDataTab(`${type}s` as 'nodes' | 'edges');
    }
  };

  const clearSelection = () => {
    setSelectedElement(null);
    setGraphFocusRequest(null);
  };

  return {
    activeTab,
    setActiveTab,
    dataTab,
    setDataTab,
    graphFocusRequest,
    handleElementDoubleClick,
    clearSelection,
  };
}
