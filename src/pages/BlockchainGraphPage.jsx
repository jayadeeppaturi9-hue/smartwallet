import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import cytoscape from 'cytoscape';
import {
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  RefreshCw,
  Building2,
  Wallet,
  ArrowRight,
  Crosshair,
  Play,
  Pause,
  Filter,
  Layers,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import graphApi from '../api/graph';
import investigationsApi from '../api/investigations';
import { formatApiError } from '../api/client';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import ErrorAlert from '../components/common/ErrorAlert';
import CopyButton from '../components/common/CopyButton';
import { formatCryptoAmount, truncateAddress } from '../utils/formatters';
import { useInvestigation } from '../context/InvestigationContext';
import { FORENSIC_THEME } from '../theme/forensicTheme';

// Investigation Reveal Stage Definitions
const STAGES = [
  {
    id: 1,
    key: 'target',
    name: 'Target Subject',
    label: 'Stage 1/6: Target Wallet Identified (Cyan)',
    progress: 18,
    description: 'Pinpointing target wallet subject at topological center.',
  },
  {
    id: 2,
    key: 'direct',
    name: 'Direct Counterparties',
    label: 'Stage 2/6: 1-Hop Counterparties Traced (Emerald)',
    progress: 38,
    description: 'Analyzing immediate counterparties and bilateral transfers.',
  },
  {
    id: 3,
    key: 'intermediary',
    name: 'Intermediary Network',
    label: 'Stage 3/6: Multi-Hop Intermediary Network (Violet)',
    progress: 60,
    description: 'Mapping 2+ hop hops and peel-chain intermediary wallets.',
  },
  {
    id: 4,
    key: 'vasp',
    name: 'VASP Identification',
    label: 'Stage 4/6: Verified VASP Entities Isolated (Amber)',
    progress: 82,
    description: 'Matching counterparty addresses against verified VASP clusters.',
  },
  {
    id: 5,
    key: 'connections',
    name: 'Full Flow Connections',
    label: 'Stage 5/6: Complete Transfer Flow Network Connected',
    progress: 94,
    description: 'Establishing multi-directional flow connections and liquidity pathways.',
  },
  {
    id: 6,
    key: 'settled',
    name: 'Topology Complete',
    label: 'Stage 6/6: Forensic Topology Stabilized & Ready',
    progress: 100,
    description: 'Investigation graph stabilized. Full interactive inspection enabled.',
  },
];

export const BlockchainGraphPage = () => {
  const { activeWallet, activeInvestigationId, selectInvestigation, selectWallet } = useInvestigation();
  const containerRef = useRef(null);
  const cyRef = useRef(null);

  // Animation and Timers References (cleaned up on unmount)
  const animationTimersRef = useRef([]);
  const flowRafRef = useRef(null);
  const selectedEdgeRef = useRef(null);

  // Data & API states
  const [investigationsList, setInvestigationsList] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(activeInvestigationId || '');
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Playback & Staging States
  const [playbackState, setPlaybackState] = useState('idle');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentStageId, setCurrentStageId] = useState(0);
  const [stageStatusText, setStageStatusText] = useState('Preparing forensic topology...');
  const [reducedMotionActive, setReducedMotionActive] = useState(false);

  // Interactive Inspector Panel State
  const [selectedElement, setSelectedElement] = useState(null);

  // Controls & Options
  const [layoutName, setLayoutName] = useState('concentric');
  const [depthFilter, setDepthFilter] = useState('2');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [edgeLabelMode, setEdgeLabelMode] = useState('hidden');

  // Clear all pending animation timers
  const clearAllAnimationTimers = useCallback(() => {
    animationTimersRef.current.forEach((t) => clearTimeout(t));
    animationTimersRef.current = [];
  }, []);

  const stopFundFlowAnimation = useCallback(() => {
    if (flowRafRef.current) {
      cancelAnimationFrame(flowRafRef.current);
      flowRafRef.current = null;
    }
    if (selectedEdgeRef.current && cyRef.current) {
      try {
        selectedEdgeRef.current.removeClass('flow-active');
        selectedEdgeRef.current.removeStyle('line-dash-offset');
      } catch {
        // Element may already be destroyed
      }
      selectedEdgeRef.current = null;
    }
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      clearAllAnimationTimers();
      stopFundFlowAnimation();
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [clearAllAnimationTimers, stopFundFlowAnimation]);

  // Detect user prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotionActive(mediaQuery.matches);

    const listener = (e) => setReducedMotionActive(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // Load investigation cases list
  useEffect(() => {
    let isMounted = true;
    const loadList = async () => {
      try {
        const data = await investigationsApi.listInvestigations();
        const list = Array.isArray(data) ? data : data?.results || [];
        if (!isMounted) return;
        setInvestigationsList(list);
        if (!activeInvestigationId && !activeWallet && list.length > 0) {
          setSelectedCaseId(list[0].id);
          selectInvestigation(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load investigations list for graph:', err);
      }
    };
    loadList();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeInvestigationId) {
      setSelectedCaseId(activeInvestigationId);
    }
  }, [activeInvestigationId]);

  const handleCaseChange = (newId) => {
    setSelectedCaseId(newId);
    if (newId) {
      selectInvestigation(newId);
      const targetCase = investigationsList.find((c) => String(c.id) === String(newId));
      if (targetCase?.wallet_address) {
        selectWallet(targetCase.wallet_address);
      }
    }
  };

  // Fetch real graph data from Django backend
  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedElement(null);
    clearAllAnimationTimers();
    stopFundFlowAnimation();

    try {
      const params = {};
      const invId = selectedCaseId || activeInvestigationId;
      if (invId) params.investigation_id = invId;
      else if (activeWallet) params.wallet_address = activeWallet;
      params.depth = parseInt(depthFilter, 10) || 2;

      const data = await graphApi.getGraphData(params);
      if (data && (Array.isArray(data.nodes) || Array.isArray(data.elements))) {
        setGraphData(data);
      } else {
        setGraphData({ nodes: [], edges: [], summary: {} });
      }
    } catch (err) {
      setError(formatApiError(err));
      setGraphData({ nodes: [], edges: [], summary: {} });
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId, activeInvestigationId, activeWallet, depthFilter, clearAllAnimationTimers, stopFundFlowAnimation]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Dynamic Statistics derived purely from real backend graph data
  const dynamicStats = useMemo(() => {
    const rawNodes = graphData?.nodes || graphData?.elements?.nodes || [];
    const rawEdges = graphData?.edges || graphData?.elements?.edges || [];
    const directCount = rawNodes.filter((n) => n.hops === 1 && !n.is_vasp).length;
    const intermediaryCount = rawNodes.filter((n) => n.hops > 1 && !n.is_vasp).length;
    const vaspCount = rawNodes.filter((n) => n.is_vasp).length;

    return {
      totalNodes: rawNodes.length,
      totalEdges: rawEdges.length,
      directCount,
      intermediaryCount,
      vaspCount,
    };
  }, [graphData]);

  // Stage Execution Engine
  const executeStage = useCallback((cy, stageId, isInstant = false) => {
    if (!cy || cy.destroyed()) return;

    const targetNodes = cy.$('node[role = "target"]');
    const directNodes = cy.$('node[role = "direct_counterparty"]');
    const directEdges = cy.$('edge.direct-edge');
    const intermediaryNodes = cy.$('node[role = "intermediary"]');
    const intermediaryEdges = cy.$('edge.intermediary-edge');
    const vaspNodes = cy.$('node[is_vasp = true]');
    const vaspEdges = cy.$('edge.vasp-edge');
    const allEdges = cy.$('edge');

    setCurrentStageId(stageId);
    const stageDef = STAGES.find((s) => s.id === stageId);
    if (stageDef) {
      setPlaybackProgress(stageDef.progress);
      setStageStatusText(stageDef.label);
    }

    cy.batch(() => {
      if (stageId >= 1) {
        targetNodes.removeClass('element-hidden').addClass('element-revealed target-pulsing');
      }

      if (stageId >= 2) {
        directNodes.removeClass('element-hidden').addClass('element-revealed');
        directEdges.removeClass('element-hidden').addClass('element-revealed');
      }

      if (stageId >= 3) {
        intermediaryNodes.removeClass('element-hidden').addClass('element-revealed');
        intermediaryEdges.removeClass('element-hidden').addClass('element-revealed');
      }

      if (stageId >= 4) {
        vaspNodes.removeClass('element-hidden').addClass('element-revealed');
        vaspEdges.removeClass('element-hidden').addClass('element-revealed');
      }

      if (stageId >= 5) {
        allEdges.removeClass('element-hidden').addClass('element-revealed');
      }

      if (stageId >= 6) {
        targetNodes.removeClass('target-pulsing').addClass('target-calm');
        setPlaybackState('completed');
        setPlaybackProgress(100);
        setStageStatusText('Forensic Topology Stabilized & Ready (100%)');
      }
    });

    if (stageId === 6 && !isInstant) {
      try {
        if (targetNodes.length > 0) {
          cy.animate(
            {
              fit: {
                eles: cy.elements('.element-revealed'),
                padding: 45,
              },
            },
            { duration: 550 }
          );
        }
      } catch {
        // Ignore animation cancellation
      }
    }
  }, []);

  // Staged Playback Scheduler
  const startStagedPlayback = useCallback(
    (startFromStage = 1) => {
      const cy = cyRef.current;
      if (!cy || cy.destroyed()) return;

      clearAllAnimationTimers();
      setPlaybackState('playing');

      if (reducedMotionActive) {
        cy.batch(() => {
          cy.elements().removeClass('element-hidden').addClass('element-revealed');
          cy.$('node[role = "target"]').removeClass('target-pulsing').addClass('target-calm');
        });
        setCurrentStageId(6);
        setPlaybackProgress(100);
        setStageStatusText('Topology Complete (Reduced Motion Active)');
        setPlaybackState('completed');
        cy.fit(undefined, 40);
        return;
      }

      const stageDelays = {
        1: 0,
        2: 900,
        3: 2100,
        4: 3300,
        5: 4400,
        6: 5400,
      };

      const baseDelay = stageDelays[startFromStage] || 0;

      for (let s = startFromStage; s <= 6; s++) {
        const scheduledTime = Math.max(0, stageDelays[s] - baseDelay);
        const timerId = setTimeout(() => {
          executeStage(cy, s);
        }, scheduledTime);
        animationTimersRef.current.push(timerId);
      }
    },
    [clearAllAnimationTimers, executeStage, reducedMotionActive]
  );

  // Play / Pause / Replay Handlers
  const handlePlay = () => {
    if (playbackState === 'completed') {
      handleReplay();
      return;
    }
    const nextStage = Math.max(1, currentStageId);
    startStagedPlayback(nextStage);
  };

  const handlePause = () => {
    clearAllAnimationTimers();
    setPlaybackState('paused');
    setStageStatusText(`Analysis Visualization Paused at Stage ${currentStageId || 1}/6`);
  };

  const handleReplay = () => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed()) return;

    clearAllAnimationTimers();
    stopFundFlowAnimation();
    setSelectedElement(null);

    cy.batch(() => {
      cy.elements().removeClass('element-revealed target-pulsing target-calm').addClass('element-hidden');
    });

    setCurrentStageId(0);
    setPlaybackProgress(0);
    setStageStatusText('Starting Forensic Investigation Reveal...');
    startStagedPlayback(1);
  };

  // Fund Flow Directional Marching Ants on Selected Edge
  const startFundFlowAnimation = useCallback((edge) => {
    if (!edge || edge.destroyed()) return;

    if (flowRafRef.current) {
      cancelAnimationFrame(flowRafRef.current);
      flowRafRef.current = null;
    }
    if (selectedEdgeRef.current && selectedEdgeRef.current !== edge) {
      try {
        selectedEdgeRef.current.removeClass('flow-active');
        selectedEdgeRef.current.removeStyle('line-dash-offset');
      } catch {
        // noop
      }
    }

    selectedEdgeRef.current = edge;
    edge.addClass('flow-active');

    let offset = 0;
    const animate = () => {
      if (!cyRef.current || cyRef.current.destroyed() || !selectedEdgeRef.current) return;
      offset = (offset - 1) % 24;
      try {
        selectedEdgeRef.current.style('line-dash-offset', offset);
        flowRafRef.current = requestAnimationFrame(animate);
      } catch {
        // Ignore style update on unmounted element
      }
    };
    flowRafRef.current = requestAnimationFrame(animate);
  }, []);

  // Initialize Cytoscape with pre-computed stable layout and semantic colors
  useEffect(() => {
    if (!containerRef.current) return;

    const rawNodes = graphData?.nodes || graphData?.elements?.nodes || [];
    const rawEdges = graphData?.edges || graphData?.elements?.edges || [];

    if (rawNodes.length === 0) {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      setPlaybackState('idle');
      setPlaybackProgress(0);
      return;
    }

    const targetAddr = (activeWallet || '').toLowerCase();
    const knownVaspAddresses = new Set(
      rawNodes.filter((n) => n.is_vasp).map((n) => String(n.id || n.address).toLowerCase())
    );
    const highRiskAddresses = new Set(
      rawNodes
        .filter((n) => n.risk_level === 'critical' || n.risk_level === 'high')
        .map((n) => String(n.id || n.address).toLowerCase())
    );

    // Build elements with forensic attributes
    const elements = [
      ...rawNodes.map((node) => {
        const id = String(node.id || node.address);
        const isTarget = targetAddr && node.address && node.address.toLowerCase() === targetAddr;
        const role = isTarget
          ? 'target'
          : node.is_vasp
          ? 'vasp'
          : node.hops === 1
          ? 'direct_counterparty'
          : 'intermediary';

        return {
          group: 'nodes',
          classes: 'element-hidden',
          data: {
            id,
            label: node.vasp_name || node.short_address || truncateAddress(node.address || id, 4, 3),
            address: node.address || id,
            short_address: node.short_address || truncateAddress(node.address || id, 4, 3),
            role,
            tier: isTarget ? 1 : node.hops === 1 ? 2 : node.is_vasp ? 4 : 3,
            isTarget,
            is_vasp: Boolean(node.is_vasp),
            vasp_name: node.vasp_name || null,
            risk_level: node.risk_level || (node.is_vasp ? 'high' : 'low'),
            balance: node.balance,
            tx_count: node.tx_count || 0,
            hops: node.hops !== undefined ? node.hops : 0,
            total_in: node.total_in || 0,
            total_out: node.total_out || 0,
          },
        };
      }),
      ...rawEdges.map((edge, idx) => {
        const src = String(edge.source || edge.from_address || edge.from).toLowerCase();
        const tgt = String(edge.target || edge.to_address || edge.to).toLowerCase();
        const isVaspEdge = knownVaspAddresses.has(src) || knownVaspAddresses.has(tgt);
        const isDirect = Boolean(edge.is_direct) || src === targetAddr || tgt === targetAddr;
        const isRiskEdge = highRiskAddresses.has(src) || highRiskAddresses.has(tgt);
        const count = edge.count || 1;
        const amountStr = edge.amount ? `${formatCryptoAmount(edge.amount)} ${edge.asset || ''}`.trim() : '';

        let edgeClass = 'element-hidden';
        if (isVaspEdge) edgeClass += ' vasp-edge';
        else if (isRiskEdge) edgeClass += ' risk-edge';
        else if (isDirect) edgeClass += ' direct-edge';
        else edgeClass += ' intermediary-edge';

        return {
          group: 'edges',
          classes: edgeClass,
          data: {
            id: edge.id || `edge-${idx}`,
            source: src,
            target: tgt,
            amount: edge.amount,
            asset: edge.asset || 'ETH',
            count,
            is_direct: isDirect,
            label: edge.label || amountStr,
            count_label: `${count} tx${count > 1 ? 's' : ''}`,
          },
        };
      }),
    ];

    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      boxSelectionEnabled: false,
      style: [
        // Base Node Style
        {
          selector: 'node',
          style: {
            'background-color': '#0c1220',
            'border-width': 2,
            'border-color': '#1d283e',
            label: 'data(label)',
            color: '#cbd5e1',
            'font-family': 'JetBrains Mono, Menlo, monospace',
            'font-size': '10px',
            'font-weight': 500,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            width: 32,
            height: 32,
            'transition-property':
              'opacity, width, height, border-width, border-color, background-color, shadow-blur, shadow-opacity',
            'transition-duration': '0.35s',
          },
        },
        // Hidden element class (staged reveal)
        {
          selector: '.element-hidden',
          style: {
            opacity: 0,
            events: 'no',
          },
        },
        // Revealed element class
        {
          selector: '.element-revealed',
          style: {
            opacity: 1,
            events: 'yes',
          },
        },
        // Filter-dimmed class
        {
          selector: '.element-dimmed',
          style: {
            opacity: 0.1,
            events: 'no',
          },
        },

        // ==========================================
        // SEMANTIC FORENSIC NODE COLOR HIERARCHY
        // ==========================================

        // 1. Target Wallet (Subject) -> CYAN
        {
          selector: 'node[role = "target"]',
          style: {
            'background-color': FORENSIC_THEME.target.bg,
            'border-color': FORENSIC_THEME.target.border,
            'border-width': 3.5,
            color: FORENSIC_THEME.target.text,
            'font-weight': 'bold',
            'font-size': '11px',
            width: 48,
            height: 48,
            'shadow-blur': 14,
            'shadow-color': FORENSIC_THEME.target.shadow,
            'shadow-opacity': 0.6,
          },
        },
        // Target Wallet Pulsing during investigation reveal
        {
          selector: 'node[role = "target"].target-pulsing',
          style: {
            'border-width': 5.5,
            'border-color': '#a5f3fc',
            'shadow-blur': 30,
            'shadow-color': FORENSIC_THEME.target.shadow,
            'shadow-opacity': 0.95,
            width: 52,
            height: 52,
          },
        },
        // Target Wallet Settled State (Calm, steady)
        {
          selector: 'node[role = "target"].target-calm',
          style: {
            'border-width': 3.5,
            'border-color': FORENSIC_THEME.target.border,
            'shadow-blur': 12,
            'shadow-color': FORENSIC_THEME.target.shadow,
            'shadow-opacity': 0.45,
            width: 48,
            height: 48,
          },
        },

        // 2. Direct Counterparties (1 Hop) -> EMERALD / TEAL
        {
          selector: 'node[role = "direct_counterparty"]',
          style: {
            'background-color': FORENSIC_THEME.direct.bg,
            'border-color': FORENSIC_THEME.direct.border,
            'border-width': 2.5,
            color: FORENSIC_THEME.direct.text,
            width: 34,
            height: 34,
            'shadow-blur': 10,
            'shadow-color': FORENSIC_THEME.direct.shadow,
            'shadow-opacity': 0.5,
          },
        },

        // 3. Intermediary Wallets (Multi-hop) -> VIOLET / PURPLE
        {
          selector: 'node[role = "intermediary"]',
          style: {
            'background-color': FORENSIC_THEME.intermediary.bg,
            'border-color': FORENSIC_THEME.intermediary.border,
            'border-width': 2,
            color: FORENSIC_THEME.intermediary.text,
            width: 28,
            height: 28,
            'shadow-blur': 8,
            'shadow-color': FORENSIC_THEME.intermediary.shadow,
            'shadow-opacity': 0.4,
          },
        },

        // 4. Known VASP Entities -> AMBER / ORANGE (Round Rectangle)
        {
          selector: 'node[is_vasp = true]',
          style: {
            'background-color': FORENSIC_THEME.vasp.bg,
            'border-color': FORENSIC_THEME.vasp.border,
            'border-width': 3,
            color: FORENSIC_THEME.vasp.text,
            'font-weight': 'bold',
            shape: 'round-rectangle',
            width: 44,
            height: 44,
            'shadow-blur': 18,
            'shadow-color': FORENSIC_THEME.vasp.shadow,
            'shadow-opacity': 0.75,
          },
        },

        // 5. High Risk Node Indicator -> RED / ROSE
        {
          selector: 'node[risk_level = "critical"], node[risk_level = "high"]',
          style: {
            'border-color': FORENSIC_THEME.danger.border,
          },
        },

        // Selected Node Highlight
        {
          selector: 'node:selected',
          style: {
            'border-color': '#ffffff',
            'border-width': 4,
            'shadow-blur': 22,
            'shadow-color': '#06b6d4',
            'shadow-opacity': 1,
          },
        },

        // ==========================================
        // SEMANTIC RELATIONSHIP EDGE STYLING
        // ==========================================

        // Base Edge
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': FORENSIC_THEME.edges.base,
            'target-arrow-color': FORENSIC_THEME.edges.baseArrow,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            'transition-property': 'opacity, width, line-color, target-arrow-color',
            'transition-duration': '0.35s',
          },
        },

        // Direct Relationship Edge -> Emerald
        {
          selector: 'edge.direct-edge, edge[is_direct = true]',
          style: {
            width: 2.2,
            'line-color': FORENSIC_THEME.edges.direct,
            'target-arrow-color': FORENSIC_THEME.edges.directArrow,
          },
        },

        // Intermediary Relationship Edge -> Violet
        {
          selector: 'edge.intermediary-edge',
          style: {
            width: 1.8,
            'line-color': FORENSIC_THEME.edges.intermediary,
            'target-arrow-color': FORENSIC_THEME.edges.intermediaryArrow,
          },
        },

        // VASP Gateway Edge -> Amber
        {
          selector: 'edge.vasp-edge',
          style: {
            width: 2.4,
            'line-color': FORENSIC_THEME.edges.vasp,
            'target-arrow-color': FORENSIC_THEME.edges.vaspArrow,
          },
        },

        // High Risk Transfer Edge -> Red/Rose
        {
          selector: 'edge.risk-edge',
          style: {
            width: 2.2,
            'line-color': FORENSIC_THEME.edges.danger,
            'target-arrow-color': FORENSIC_THEME.edges.dangerArrow,
          },
        },

        // Selected Edge (Highlighted with details) -> Cyan
        {
          selector: 'edge:selected',
          style: {
            width: 3.5,
            'line-color': FORENSIC_THEME.edges.selected,
            'target-arrow-color': FORENSIC_THEME.edges.selected,
            'arrow-scale': 1.25,
            label: 'data(label)',
            color: '#67e8f9',
            'font-size': '10px',
            'font-family': 'JetBrains Mono, monospace',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'text-background-color': '#070b14',
            'text-background-opacity': 0.95,
            'text-background-padding': '3px',
            'text-border-color': '#06b6d4',
            'text-border-width': 1,
          },
        },

        // Active Directional Fund Flow -> Marching Ants Cyan
        {
          selector: 'edge.flow-active',
          style: {
            'line-style': 'dashed',
            'line-dash-pattern': [8, 4],
            'line-color': FORENSIC_THEME.edges.flow,
            'target-arrow-color': FORENSIC_THEME.edges.flow,
          },
        },

        // Edge Label Modes
        {
          selector: 'edge.mode-amount',
          style: {
            label: 'data(label)',
            color: '#cbd5e1',
            'font-size': '9px',
            'font-family': 'JetBrains Mono, monospace',
            'text-rotation': 'autorotate',
            'text-margin-y': -6,
            'text-background-color': '#070b14',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge.mode-count',
          style: {
            label: 'data(count_label)',
            color: '#cbd5e1',
            'font-size': '9px',
            'font-family': 'JetBrains Mono, monospace',
            'text-rotation': 'autorotate',
            'text-margin-y': -6,
            'text-background-color': '#070b14',
            'text-background-opacity': 0.85,
            'text-background-padding': '2px',
          },
        },
      ],
      layout: {
        name: layoutName,
        roots:
          layoutName === 'breadthfirst' && targetAddr
            ? `node[address = "${targetAddr}"]`
            : undefined,
        concentric: (node) => {
          if (node.data('isTarget') || node.data('hops') === 0) return 4;
          if (node.data('hops') === 1 && !node.data('is_vasp')) return 3;
          if (node.data('hops') >= 2 && !node.data('is_vasp')) return 2;
          if (node.data('is_vasp')) return 1;
          return 1;
        },
        levelWidth: () => 1,
        directed: true,
        animate: false,
        fit: true,
        padding: 45,
        spacingFactor: 1.45,
      },
    });

    // Event Listeners: Node & Edge Selection works immediately during and after animation
    cy.on('tap', 'node', (evt) => {
      stopFundFlowAnimation();
      setSelectedElement({ type: 'node', data: evt.target.data() });
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      setSelectedElement({ type: 'edge', data: edge.data() });
      startFundFlowAnimation(edge);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedElement(null);
        stopFundFlowAnimation();
      }
    });

    cyRef.current = cy;

    // Trigger Investigation Reveal Animation
    startStagedPlayback(1);
  }, [graphData, layoutName, activeWallet, startStagedPlayback, startFundFlowAnimation, stopFundFlowAnimation]);

  // Handle Edge Label Mode Toggle
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed()) return;

    cy.batch(() => {
      cy.edges().removeClass('mode-amount mode-count');
      if (edgeLabelMode === 'amounts') {
        cy.edges().addClass('mode-amount');
      } else if (edgeLabelMode === 'counts') {
        cy.edges().addClass('mode-count');
      }
    });
  }, [edgeLabelMode]);

  // Handle Filter (preserves node geometry while dimming non-matching elements)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || cy.destroyed()) return;

    cy.batch(() => {
      const allNodes = cy.nodes();
      const allEdges = cy.edges();

      if (nodeFilter === 'all') {
        allNodes.removeClass('element-dimmed');
        allEdges.removeClass('element-dimmed');
        return;
      }

      allNodes.forEach((node) => {
        let match = false;
        if (nodeFilter === 'target_only') {
          match = node.data('role') === 'target';
        } else if (nodeFilter === 'direct_only') {
          match = node.data('hops') <= 1 && !node.data('is_vasp');
        } else if (nodeFilter === 'intermediary_only') {
          match = node.data('hops') > 1 && !node.data('is_vasp');
        } else if (nodeFilter === 'vasp_only') {
          match = node.data('is_vasp') === true || node.data('role') === 'target';
        }

        if (match) {
          node.removeClass('element-dimmed');
        } else {
          node.addClass('element-dimmed');
        }
      });

      allEdges.forEach((edge) => {
        const src = edge.source();
        const tgt = edge.target();
        if (src.hasClass('element-dimmed') || tgt.hasClass('element-dimmed')) {
          edge.addClass('element-dimmed');
        } else {
          edge.removeClass('element-dimmed');
        }
      });
    });
  }, [nodeFilter]);

  // Graph Viewport Controls
  const handleZoomIn = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current && cyRef.current.fit(undefined, 40);
  const handleCenterTarget = () => {
    if (!cyRef.current || !activeWallet) return;
    const targetNode = cyRef.current.$(`node[address = "${activeWallet.toLowerCase()}"]`);
    if (targetNode.length) {
      cyRef.current.center(targetNode);
      cyRef.current.zoom(1.35);
    }
  };
  const handleResetLayout = () => {
    if (cyRef.current) {
      const targetAddr = (activeWallet || '').toLowerCase();
      cyRef.current
        .layout({
          name: layoutName,
          roots:
            layoutName === 'breadthfirst' && targetAddr
              ? `node[address = "${targetAddr}"]`
              : undefined,
          concentric: (node) => {
            if (node.data('isTarget') || node.data('hops') === 0) return 4;
            if (node.data('hops') === 1 && !node.data('is_vasp')) return 3;
            if (node.data('hops') >= 2 && !node.data('is_vasp')) return 2;
            if (node.data('is_vasp')) return 1;
            return 1;
          },
          levelWidth: () => 1,
          directed: true,
          animate: true,
          animationDuration: 500,
          fit: true,
          padding: 45,
          spacingFactor: 1.45,
        })
        .run();
    }
  };

  const rawNodes = graphData?.nodes || graphData?.elements?.nodes || [];

  return (
    <div className="space-y-3.5 flex flex-col h-[calc(100vh-7.5rem)] font-sans">
      {/* Top Header & Investigation Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <GitFork className="w-6 h-6 text-cyan-400" />
            <span>Forensic Blockchain Relationship Graph</span>
            {reducedMotionActive && (
              <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 text-[10px] ml-1">
                ⚡ Reduced Motion
              </Badge>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Semantic Topological Reveal: Target (Cyan) → Direct 1-Hop (Emerald) → Intermediary (Violet) → Verified VASP (Amber).
          </p>
        </div>

        {/* Toolbar: Case Selection & Depth */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Case Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 shadow-sm">
            <span className="text-slate-500 font-mono text-[10px]">CASE:</span>
            <select
              value={selectedCaseId}
              onChange={(e) => handleCaseChange(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs font-mono max-w-[140px] truncate cursor-pointer"
            >
              <option value="">Select Case...</option>
              {investigationsList.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                  #{c.id} {c.name || truncateAddress(c.wallet_address)}
                </option>
              ))}
            </select>
          </div>

          {/* Depth Filter */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 shadow-sm">
            <span className="text-slate-500 font-mono text-[10px]">DEPTH:</span>
            <select
              value={depthFilter}
              onChange={(e) => setDepthFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs font-mono cursor-pointer"
            >
              <option value="1" className="bg-slate-900">1 Hop</option>
              <option value="2" className="bg-slate-900">2 Hops</option>
              <option value="3" className="bg-slate-900">3 Hops</option>
            </select>
          </div>

          {/* Entity Filter */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 shadow-sm">
            <Filter className="w-3 h-3 text-slate-500" />
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs font-mono cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Entities</option>
              <option value="target_only" className="bg-slate-900">Target Subject Only</option>
              <option value="direct_only" className="bg-slate-900">Direct 1-Hop (Emerald)</option>
              <option value="intermediary_only" className="bg-slate-900">Intermediaries (Violet)</option>
              <option value="vasp_only" className="bg-slate-900">Known VASPs (Amber)</option>
            </select>
          </div>

          {/* Topology Layout */}
          <select
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer shadow-sm"
          >
            <option value="concentric" className="bg-slate-900">Radar (Concentric)</option>
            <option value="breadthfirst" className="bg-slate-900">Hierarchical Tree</option>
            <option value="cose" className="bg-slate-900">Force-Directed</option>
            <option value="circle" className="bg-slate-900">Radial Circle</option>
          </select>

          {/* Refresh Graph */}
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            onClick={fetchGraph}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic Semantic Graph Telemetry KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total Nodes</span>
            <span className="text-sm font-bold text-white font-mono">{dynamicStats.totalNodes}</span>
          </div>
          <Wallet className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Relationships</span>
            <span className="text-sm font-bold text-white font-mono">{dynamicStats.totalEdges}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300" />
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-mono">1-Hop (Direct)</span>
            <span className="text-sm font-bold text-emerald-300 font-mono">{dynamicStats.directCount}</span>
          </div>
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-purple-400 uppercase tracking-wider block font-mono">Intermediaries</span>
            <span className="text-sm font-bold text-purple-300 font-mono">{dynamicStats.intermediaryCount}</span>
          </div>
          <Layers className="w-4 h-4 text-purple-400" />
        </div>
        <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-mono">Known VASPs</span>
            <span className="text-sm font-bold text-amber-300 font-mono">{dynamicStats.vaspCount}</span>
          </div>
          <Building2 className="w-4 h-4 text-amber-400" />
        </div>
      </div>

      {error && (
        <ErrorAlert
          title="Graph Topology Error"
          error={error}
          onRetry={fetchGraph}
        />
      )}

      {/* Main Graph Canvas Area */}
      <div className="relative flex-1 rounded-xl border border-slate-800 bg-[#070b14] overflow-hidden shadow-2xl">
        {/* Cytoscape Container */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Floating Top-Left Viewport Controls */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 p-1 rounded-lg bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="h-px bg-slate-800 my-0.5" />
          <button
            onClick={handleFit}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Fit Entire Graph"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleCenterTarget}
            className="p-1.5 rounded hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Center Target Subject"
          >
            <Crosshair className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetLayout}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Re-run Stable Layout"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Forensic Playback HUD */}
        {rawNodes.length > 0 && (
          <div className="absolute top-3 right-3 sm:right-auto sm:left-16 z-10 max-w-[calc(100%-5rem)] sm:max-w-md rounded-lg bg-slate-900/95 border border-slate-800 backdrop-blur-md p-2.5 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <div className="flex items-center gap-2">
                {playbackState === 'playing' ? (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                  </span>
                ) : playbackState === 'paused' ? (
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                )}
                <span className="text-slate-300 font-semibold text-[11px] truncate">
                  {stageStatusText}
                </span>
              </div>
              <span className="text-cyan-400 font-bold text-[11px] shrink-0">
                {playbackProgress}%
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${playbackProgress}%` }}
              />
            </div>

            {/* Investigation Playback Controls */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <div className="flex items-center gap-1.5">
                {playbackState === 'playing' ? (
                  <button
                    onClick={handlePause}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-semibold transition-colors"
                    title="Pause Investigation Playback"
                  >
                    <Pause className="w-3 h-3" />
                    <span>PAUSE</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePlay}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-semibold transition-colors"
                    title="Play / Resume Investigation Playback"
                  >
                    <Play className="w-3 h-3" />
                    <span>PLAY</span>
                  </button>
                )}
                <button
                  onClick={handleReplay}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                  title="Replay Investigation Order"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>REPLAY</span>
                </button>
              </div>

              {/* Edge Label Visibility Control */}
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="text-slate-500">LABELS:</span>
                <button
                  onClick={() => setEdgeLabelMode('hidden')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    edgeLabelMode === 'hidden'
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700'
                      : 'hover:text-white'
                  }`}
                >
                  Off
                </button>
                <button
                  onClick={() => setEdgeLabelMode('amounts')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    edgeLabelMode === 'amounts'
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700'
                      : 'hover:text-white'
                  }`}
                >
                  Amount
                </button>
                <button
                  onClick={() => setEdgeLabelMode('counts')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    edgeLabelMode === 'counts'
                      ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700'
                      : 'hover:text-white'
                  }`}
                >
                  Count
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Semantic Color Hierarchy Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-lg bg-slate-900/95 border border-slate-800 backdrop-blur-md text-[10px] font-mono text-slate-300 space-y-1.5 hidden md:block shadow-xl">
          <div className="text-[9px] uppercase font-mono tracking-wider text-slate-500 mb-0.5">
            Semantic Color Hierarchy
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
            <span>Target Wallet (Subject) — Cyan</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
            <span>Direct Counterparties (1 Hop) — Emerald</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500" />
            <span>Intermediary Wallets (2+ Hops) — Violet</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-amber-500 shadow-sm shadow-amber-500" />
            <span>Verified VASP Entities — Amber</span>
          </div>
        </div>

        {/* Empty State Overlay */}
        {!loading && rawNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-950/90">
            <EmptyState
              icon={GitFork}
              title="No relationship graph available"
              description={
                activeWallet
                  ? `No on-chain counterparties found for ${activeWallet} within ${depthFilter}-hop traversal. Select or create an active investigation.`
                  : 'Select an investigated wallet to visualize the relationship graph.'
              }
            />
          </div>
        )}

        {/* Forensic Loading State Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs z-30">
            <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl">
              <div className="relative">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping" />
              </div>
              <div className="text-center font-mono">
                <p className="text-sm font-semibold text-white">Building investigation graph…</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Analyzing on-chain counterparty topology via NetworkX
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Inspector Panel (Nodes & Edges) */}
        {selectedElement && (
          <div className="absolute top-3 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-xl bg-slate-900/95 border border-slate-800 backdrop-blur-md shadow-2xl p-4 animate-in fade-in slide-in-from-right-4 font-mono text-xs">
            <div className="flex items-start justify-between gap-2 pb-2 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                {selectedElement.type === 'node' ? (
                  <Wallet className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                )}
                <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                  {selectedElement.type === 'node' ? 'Wallet Node Telemetry' : 'Fund Flow Transfer'}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedElement(null);
                  stopFundFlowAnimation();
                }}
                className="text-slate-400 hover:text-white p-0.5"
                title="Close Inspector"
              >
                ✕
              </button>
            </div>

            {selectedElement.type === 'node' ? (
              <div className="space-y-2.5">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Wallet Address</span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-cyan-300 break-all text-[11px] select-all">
                      {selectedElement.data.address}
                    </span>
                    <CopyButton text={selectedElement.data.address} size="xs" />
                  </div>
                </div>

                {selectedElement.data.vasp_name && (
                  <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/50">
                    <span className="text-[9px] text-amber-400 uppercase block font-semibold">
                      Verified VASP Entity (Amber)
                    </span>
                    <span className="font-bold text-amber-200 text-sm">
                      {selectedElement.data.vasp_name}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[9px] uppercase">Classification</span>
                    <span
                      className={`capitalize font-medium ${
                        selectedElement.data.isTarget
                          ? 'text-cyan-400'
                          : selectedElement.data.is_vasp
                          ? 'text-amber-400'
                          : selectedElement.data.hops === 1
                          ? 'text-emerald-400'
                          : 'text-purple-400'
                      }`}
                    >
                      {selectedElement.data.role?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[9px] uppercase">Hop Distance</span>
                    <span className="text-slate-200 font-medium">
                      {selectedElement.data.hops} Hop{selectedElement.data.hops === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Transaction Count:</span>
                    <span className="text-slate-200 font-semibold">{selectedElement.data.tx_count}</span>
                  </div>
                  {selectedElement.data.total_in !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Inflow:</span>
                      <span className="text-emerald-400 font-semibold">
                        {formatCryptoAmount(selectedElement.data.total_in)}
                      </span>
                    </div>
                  )}
                  {selectedElement.data.total_out !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Total Outflow:</span>
                      <span className="text-rose-400 font-semibold">
                        {formatCryptoAmount(selectedElement.data.total_out)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-1.5">
                  <Button
                    variant="cyan"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => selectWallet(selectedElement.data.address)}
                  >
                    Set as Investigation Target
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                  <span className="text-slate-500 block text-[9px] uppercase">Total Transfer Volume</span>
                  <span className="text-cyan-300 font-bold text-sm">
                    {formatCryptoAmount(selectedElement.data.amount, selectedElement.data.asset)}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Transaction Count:</span>
                    <span className="text-slate-200 font-semibold">{selectedElement.data.count}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Source Wallet</span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-slate-300 text-[11px] break-all select-all">
                      {selectedElement.data.source}
                    </span>
                    <CopyButton text={selectedElement.data.source} size="xs" />
                  </div>
                </div>

                <div className="flex items-center justify-center my-0.5">
                  <div className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 text-[10px] font-semibold flex items-center gap-1">
                    <span>SOURCE</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                    <span>DESTINATION</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Destination Wallet</span>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-slate-300 text-[11px] break-all select-all">
                      {selectedElement.data.target}
                    </span>
                    <CopyButton text={selectedElement.data.target} size="xs" />
                  </div>
                </div>

                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                  <span className="text-slate-500 block text-[9px] uppercase">Relationship Type</span>
                  <span className="text-slate-200 font-semibold">
                    {selectedElement.data.is_direct ? 'Direct 1-Hop Relationship (Emerald)' : 'Intermediary Route (Violet)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockchainGraphPage;
