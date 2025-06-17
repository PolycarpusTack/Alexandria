import { useState, useEffect, useCallback } from 'react';
import { mnemosyneAPI, KnowledgeNode } from '../api/client';

export const useNodes = (parentId?: string) => {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mnemosyneAPI.getNodes(parentId);
      setNodes(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const createNode = useCallback(async (node: Omit<KnowledgeNode, 'id' | 'metadata'>) => {
    try {
      const newNode = await mnemosyneAPI.createNode(node);
      setNodes(prev => [...prev, newNode]);
      return newNode;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const updateNode = useCallback(async (id: string, updates: Partial<KnowledgeNode>) => {
    try {
      const updatedNode = await mnemosyneAPI.updateNode(id, updates);
      setNodes(prev => prev.map(n => n.id === id ? updatedNode : n));
      return updatedNode;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const deleteNode = useCallback(async (id: string) => {
    try {
      await mnemosyneAPI.deleteNode(id);
      setNodes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    nodes,
    loading,
    error,
    refetch: fetchNodes,
    createNode,
    updateNode,
    deleteNode
  };
};

export const useNode = (id: string) => {
  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchNode = async () => {
      try {
        setLoading(true);
        const data = await mnemosyneAPI.getNode(id);
        setNode(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    if (id && id !== 'new') {
      fetchNode();
    } else {
      setLoading(false);
    }
  }, [id]);

  const updateNode = useCallback(async (updates: Partial<KnowledgeNode>) => {
    if (!node) return;
    
    try {
      const updatedNode = await mnemosyneAPI.updateNode(node.id, updates);
      setNode(updatedNode);
      return updatedNode;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [node]);

  return {
    node,
    loading,
    error,
    updateNode
  };
};