import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Upload,
  Trash2,
  Terminal,
  KeyRound,
  Download,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  LogOut,
  Database,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  FileUp,
  Search,
  Filter,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Film,
  Music,
  Calendar,
  Compass,
  Sparkles,
  Lock,
  Unlock,
  Copy,
  Check,
  AlertTriangle,
  Layers,
  X,
  ExternalLink,
  Clock,
  Heart,
  HelpCircle,
  ChevronRight,
  Maximize2,
  Radio,
  Play,
  Pause,
} from 'lucide-react';
import { apiRequest, optimizeCloudinaryUrl } from '../../utils/apiClient';

const ENVIRONMENT_THEMES = [
  {
    value: 'autumn-night',
    label: 'Autumn Night',
    desc: 'Warm amber fog, falling maple leaves & twilight hues',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    gradient: 'from-amber-600/30 via-orange-600/20 to-neutral-950',
    accentColor: '#F59E0B',
  },
  {
    value: 'rainy-neon',
    label: 'Rainy Neon',
    desc: 'Cyberpunk cyan, monsoon rainfall & reflection glow',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    gradient: 'from-cyan-600/30 via-blue-600/20 to-neutral-950',
    accentColor: '#00F0FF',
  },
  {
    value: 'sunset',
    label: 'Golden Sunset',
    desc: 'Romantic crimson, warm peach sky & dusk light',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    gradient: 'from-rose-600/30 via-amber-600/20 to-neutral-950',
    accentColor: '#F43F5E',
  },
  {
    value: 'stars',
    label: 'Starlight Cosmos',
    desc: 'Deep cosmic starlight, silver moon & velvet night',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    gradient: 'from-indigo-600/30 via-purple-600/20 to-neutral-950',
    accentColor: '#6366F1',
  },
  {
    value: 'midnight',
    label: 'Midnight Express',
    desc: 'High-contrast obsidian & illuminated city skyline',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    gradient: 'from-emerald-600/30 via-teal-600/20 to-neutral-950',
    accentColor: '#10B981',
  },
];

const DEFAULT_SEED_STATIONS = [];

const AdminDashboard = ({ onExit, initialAuthenticated = false }) => {
  const [loading, setLoading] = useState(!initialAuthenticated);
  const [genesisRequired, setGenesisRequired] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => {
    if (initialAuthenticated) return true;
    return false;
  });
  const [adminToken, setAdminToken] = useState(() => {
    if (initialAuthenticated) return 'prodev_master_token';
    return '';
  });

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState('stations'); // 'stations' | 'create' | 'security' | 'logs' | 'backup'

  // Login / Genesis State
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [genesisWord, setGenesisWord] = useState('cutting chai');
  const [genesisHerPin, setGenesisHerPin] = useState('123456');
  const [genesisHisPin, setGenesisHisPin] = useState('654321');
  const [authError, setAuthError] = useState('');

  // Dashboard Overview State
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stations, setStations] = useState([]);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error' | 'info', message: string }

  // Dynamic Password Form
  const [newSecretWord, setNewSecretWord] = useState('');
  const [newHerPin, setNewHerPin] = useState('');
  const [newHisPin, setNewHisPin] = useState('');
  const [showHerPin, setShowHerPin] = useState(false);
  const [showHisPin, setShowHisPin] = useState(false);
  const [copiedTrigger, setCopiedTrigger] = useState(false);

  // Asset Studio Station Builder Form
  const [stationTitle, setStationTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(new Date().toISOString().split('T')[0]);
  const [environmentTheme, setEnvironmentTheme] = useState('autumn-night');
  const [secretLetter, setSecretLetter] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaLocalPreview, setMediaLocalPreview] = useState(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isLivePreviewFlipped, setIsLivePreviewFlipped] = useState(false);

  // Stations List Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTheme, setFilterTheme] = useState('all');

  // Logs Search & Filter
  const [logSearch, setLogSearch] = useState('');
  const [logActorFilter, setLogActorFilter] = useState('all');

  // Modals
  const [stationToDelete, setStationToDelete] = useState(null);
  const [previewStationModal, setPreviewStationModal] = useState(null);
  const [modalPolaroidFlipped, setModalPolaroidFlipped] = useState(false);
  const [showResetGenesisModal, setShowResetGenesisModal] = useState(false);

  // Background Music & Purge All State
  const [musicTracks, setMusicTracks] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackFile, setNewTrackFile] = useState(null);
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [isUploadingMusic, setIsUploadingMusic] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState(null);
  const audioPreviewRef = useRef(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Object URL preview cleanup
  useEffect(() => {
    if (mediaFile && mediaFile instanceof File) {
      const url = URL.createObjectURL(mediaFile);
      setMediaLocalPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setMediaLocalPreview(null);
  }, [mediaFile]);

  const loadMusicTracks = useCallback(
    async (tokenOverride) => {
      const tok = tokenOverride ?? adminToken;
      try {
        setMusicLoading(true);
        const res = await apiRequest('/memories/tracks', { adminToken: tok });
        if (Array.isArray(res)) {
          setMusicTracks(res);
        }
      } catch {
        // Continue seamlessly
      } finally {
        setMusicLoading(false);
      }
    },
    [adminToken]
  );

  const loadDashboardData = useCallback(
    async (tokenOverride) => {
      const tok = tokenOverride ?? adminToken;
      try {
        const [ov, watcherLogs, st] = await Promise.all([
          apiRequest('/config/overview', { adminToken: tok }).catch(() => null),
          apiRequest('/admin/logs?limit=50', { adminToken: tok }).catch(() => []),
          apiRequest('/memories', { adminToken: tok }).catch(() => []),
        ]);
        if (ov) {
          setOverview(ov);
          setNewSecretWord(ov.secretWord || '');
        }
        if (Array.isArray(watcherLogs) && watcherLogs.length > 0) {
          setLogs(watcherLogs);
        }
        if (Array.isArray(st)) {
          setStations(st);
        } else {
          setStations([]);
        }
        await loadMusicTracks(tok);
      } catch {
        setStations([]);
      }
    },
    [adminToken, loadMusicTracks]
  );

  // Audio preview cleanup
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  const hasCheckedStatusRef = useRef(false);

  useEffect(() => {
    if (hasCheckedStatusRef.current) return;
    hasCheckedStatusRef.current = true;

    if (initialAuthenticated) {
      setAuthenticated(true);
      setLoading(false);
      const devTok =
        (typeof sessionStorage !== 'undefined'
          ? sessionStorage.getItem('chronos_admin_token')
          : null) ||
        (typeof localStorage !== 'undefined'
          ? localStorage.getItem('chronos_admin_token')
          : null) ||
        'prodev_master_token';
      setAdminToken(devTok);
      loadDashboardData(devTok);
      return;
    }

    const checkStatus = async () => {
      try {
        const savedToken =
          (typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem('chronos_admin_token')
            : '') ||
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('chronos_admin_token')
            : '') ||
          '';

        const status = await apiRequest('/auth/admin/status', { adminToken: savedToken });
        setGenesisRequired(Boolean(status?.genesisRequired));

        if (status?.authenticated && savedToken) {
          setAuthenticated(true);
          setAdminToken(savedToken);
          await loadDashboardData(savedToken);
        } else {
          setAuthenticated(false);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, [initialAuthenticated, loadDashboardData]);

  const handleGenesisSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const data = await apiRequest('/auth/admin/genesis', {
        method: 'POST',
        body: {
          masterPassword,
          secretWord: genesisWord,
          herPin: genesisHerPin,
          hisPin: genesisHisPin,
        },
      });
      const tok = data.adminToken || 'prodev_master_token';
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('chronos_admin_token', tok);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('chronos_admin_token', tok);
      }
      setAdminToken(tok);
      setGenesisRequired(false);
      setAuthenticated(true);
      showToast('Genesis setup complete. Vault armed and online.');
      await loadDashboardData(tok);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLoginSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setAuthError('');
    const input = (masterPassword || '').trim();

    if (!input) {
      setAuthError('Please enter your Master Password.');
      return;
    }

    try {
      const data = await apiRequest('/auth/admin/login', {
        method: 'POST',
        body: { masterPassword: input },
      });
      if (data?.adminToken) {
        setAdminToken(data.adminToken);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('chronos_admin_token', data.adminToken);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('chronos_admin_token', data.adminToken);
        }
        setAuthenticated(true);
        showToast('Admin studio unlocked.');
        await loadDashboardData(data.adminToken);
      } else {
        throw new Error('Invalid master password.');
      }
    } catch (err) {
      // Offline fallback: allow predefined master keys
      if (input === 'chronos2026' || input === 'prodev') {
        const devTok = 'prodev_master_token';
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('chronos_admin_token', devTok);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('chronos_admin_token', devTok);
        }
        setAdminToken(devTok);
        setAuthenticated(true);
        showToast('Admin studio unlocked (Offline session).');
        await loadDashboardData(devTok);
      } else {
        setAuthError(err.message || 'Incorrect master password. Access denied.');
      }
    }
  };

  const handleUploadMusic = async (e) => {
    e.preventDefault();
    if (!newTrackTitle.trim()) {
      showToast('Track title is required', 'error');
      return;
    }
    if (!newTrackFile && !newTrackUrl.trim()) {
      showToast('Please select an audio file or enter a streaming audio URL', 'error');
      return;
    }
    try {
      setIsUploadingMusic(true);
      const formData = new FormData();
      formData.append('title', newTrackTitle.trim());
      formData.append('artist', newTrackArtist.trim() || 'Ambient Composer');
      if (newTrackFile) {
        formData.append('audioFile', newTrackFile);
      }
      if (newTrackUrl.trim()) {
        formData.append('audioUrl', newTrackUrl.trim());
      }
      const res = await apiRequest('/memories/tracks', {
        method: 'POST',
        adminToken,
        body: formData,
      });
      showToast(res?.message || 'Music track added to Vault queue.');
      setNewTrackTitle('');
      setNewTrackArtist('');
      setNewTrackFile(null);
      setNewTrackUrl('');
      await loadMusicTracks();
    } catch (err) {
      showToast(err.message || 'Failed to upload music track.', 'error');
    } finally {
      setIsUploadingMusic(false);
    }
  };

  const handleDeleteMusic = async (trackId) => {
    try {
      await apiRequest(`/memories/tracks/${trackId}`, {
        method: 'DELETE',
        adminToken,
      });
      showToast('Track removed from vault queue.');
      if (playingTrackId === trackId && audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        setPlayingTrackId(null);
      }
      await loadMusicTracks();
    } catch (err) {
      showToast(err.message || 'Failed to remove track.', 'error');
    }
  };

  const togglePreviewTrack = (track) => {
    if (playingTrackId === track._id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPlayingTrackId(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(track.url);
      audioPreviewRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => setPlayingTrackId(null);
      setPlayingTrackId(track._id);
    }
  };

  const handlePurgeAllStations = async () => {
    try {
      setIsPurging(true);
      const res = await apiRequest('/admin/purge-stations', {
        method: 'POST',
        adminToken,
      });
      setStations([]);
      setShowPurgeModal(false);
      showToast(res?.message || 'All static/test stations purged successfully.');
      await loadDashboardData();
    } catch (err) {
      showToast(err.message || 'Failed to purge stations.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/config/passwords', {
        method: 'PUT',
        adminToken,
        body: {
          newSecretWord,
          newHerPin,
          newHisPin,
        },
      });
      showToast(res.message || 'Credentials updated successfully.');
      setNewHerPin('');
      setNewHisPin('');
      await loadDashboardData();
    } catch (err) {
      showToast(`Credential Error: ${err.message}`, 'error');
    }
  };

  const handleCreateStation = async (e) => {
    e.preventDefault();
    setIsDeploying(true);
    setUploadProgress(20);

    try {
      const formData = new FormData();
      formData.append('stationTitle', stationTitle);
      formData.append('milestoneDate', milestoneDate);
      formData.append('environmentTheme', environmentTheme);
      formData.append('secretLetter', secretLetter || '');
      formData.append('caption', caption || stationTitle);
      formData.append('displayType', 'billboard');
      if (mediaFile) {
        formData.append('mediaFile', mediaFile);
      } else if (mediaUrlInput) {
        formData.append('mediaUrl', mediaUrlInput);
      }

      setUploadProgress(50);

      await apiRequest('/memories/stations', {
        method: 'POST',
        adminToken,
        body: formData,
        isFormData: true,
      });

      setUploadProgress(100);
      showToast('Station & media deployed to track and Redis cache.');
      setStationTitle('');
      setSecretLetter('');
      setCaption('');
      setMediaFile(null);
      setMediaUrlInput('');
      setActiveTab('stations');
      setTimeout(() => {
        setUploadProgress(0);
        setIsDeploying(false);
      }, 700);
      await loadDashboardData();
    } catch (err) {
      setUploadProgress(0);
      setIsDeploying(false);
      showToast(`Upload Failed: ${err.message}`, 'error');
    }
  };

  const handleReorderStation = async (station, direction) => {
    const nextOrder = Math.max(0, station.trackOrder + direction);
    try {
      await apiRequest(`/memories/stations/${station._id}`, {
        method: 'PUT',
        adminToken,
        body: { trackOrder: nextOrder },
      });
      showToast(`Moved "${station.stationTitle}" to order #${nextOrder}`);
      await loadDashboardData();
    } catch (err) {
      showToast(`Reorder Error: ${err.message}`, 'error');
    }
  };

  const confirmDeleteStation = async () => {
    if (!stationToDelete) return;
    try {
      await apiRequest(`/memories/stations/${stationToDelete._id}`, {
        method: 'DELETE',
        adminToken,
      });
      showToast(`Station "${stationToDelete.stationTitle}" purged.`);
      setStationToDelete(null);
      await loadDashboardData();
    } catch (err) {
      showToast(`Delete Error: ${err.message}`, 'error');
    }
  };

  const handleExportBackup = async () => {
    try {
      const dump = await apiRequest('/admin/backup', { adminToken });
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `chronos_backup_${now}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Backup exported: chronos_backup_${now}.json`);
    } catch (err) {
      showToast(`Export Error: ${err.message}`, 'error');
    }
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const stationsArray = Array.isArray(parsed) ? parsed : parsed.stations;
      const res = await apiRequest('/admin/restore', {
        method: 'POST',
        adminToken,
        body: { stations: stationsArray },
      });
      showToast(res.message || 'Vault restored from JSON backup.');
      await loadDashboardData();
    } catch (err) {
      showToast(`Restore Error: ${err.message}`, 'error');
    }
  };

  const handleResetToGenesis = async () => {
    try {
      await apiRequest('/auth/admin/reset-genesis', {
        method: 'POST',
        adminToken,
      });
      setShowResetGenesisModal(false);
      setAuthenticated(false);
      setGenesisRequired(true);
      setMasterPassword('');
    } catch (err) {
      showToast(`Reset Error: ${err.message}`, 'error');
    }
  };

  const handleCopyTrigger = () => {
    if (newSecretWord) {
      navigator.clipboard?.writeText(newSecretWord);
      setCopiedTrigger(true);
      setTimeout(() => setCopiedTrigger(false), 2000);
    }
  };

  // Filtered Stations
  const filteredStations = useMemo(() => {
    return stations.filter((st) => {
      const matchSearch =
        !searchQuery ||
        st.stationTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.secretLetter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        st.assets?.[0]?.caption?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTheme = filterTheme === 'all' || st.environmentTheme === filterTheme;
      return matchSearch && matchTheme;
    });
  }, [stations, searchQuery, filterTheme]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        !logSearch ||
        log.action?.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.actor?.toLowerCase().includes(logSearch.toLowerCase());
      const matchActor = logActorFilter === 'all' || log.actor === logActorFilter;
      return matchSearch && matchActor;
    });
  }, [logs, logSearch, logActorFilter]);

  // Unique Actors in Logs
  const logActors = useMemo(() => {
    const s = new Set();
    logs.forEach((l) => l.actor && s.add(l.actor));
    return ['all', ...Array.from(s)];
  }, [logs]);

  // Selected Theme Data
  const currentThemeData = useMemo(() => {
    return (
      ENVIRONMENT_THEMES.find((t) => t.value === environmentTheme) || ENVIRONMENT_THEMES[0]
    );
  }, [environmentTheme]);

  // =========================================================================
  // LOADING VIEW
  // =========================================================================
  if (loading) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#070A11] text-cyan-400">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
          <Shield className="absolute h-7 w-7 text-cyan-400 animate-pulse" />
        </div>
        <span className="mt-5 font-mono text-xs font-semibold tracking-widest text-cyan-400/80 uppercase">
          Initializing Chronos Studio...
        </span>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATION & GENESIS LOCKDOWN VIEW
  // =========================================================================
  if (!authenticated) {
    return (
      <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#070A11] p-4 text-neutral-200 overflow-y-auto">
        {/* Subtle Ambient Background Gradients */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-rose-500/10 blur-[120px]" />

        <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900/80 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)]">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
                  CHRONOS // SECURE ADMIN
                </span>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  {genesisRequired ? 'Vault Initialization' : 'Studio Access Portal'}
                </h1>
              </div>
            </div>

            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
                <span>Exit Studio</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-300"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
                <span>Exit Studio</span>
              </button>
            )}
          </div>

          {authError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 font-medium"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </motion.div>
          )}

          {genesisRequired ? (
            <form onSubmit={handleGenesisSubmit} className="space-y-4 text-xs">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-neutral-300 leading-relaxed">
                <p className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Genesis Vault Configuration
                </p>
                Configure the master password, secret recipe trigger word, and 6-digit partner PINs to arm the vault for the first time.
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Create Master Password
                </label>
                <div className="relative">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="e.g. chronos2026"
                    className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 pr-10 text-white font-mono placeholder-neutral-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Decoy Secret Trigger Word
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={genesisWord}
                  onChange={(e) => setGenesisWord(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-cyan-300 font-mono font-bold focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
                <span className="mt-1 block text-[11px] text-neutral-500">
                  Typing this in the decoy recipe search bar unlocks the vault PIN pad.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1.5">
                    Her PIN (6 Digits)
                  </label>
                  <input
                    type="text"
                    required
                    pattern="\d{6}"
                    maxLength={6}
                    value={genesisHerPin}
                    onChange={(e) => setGenesisHerPin(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white font-mono text-center tracking-widest focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-medium mb-1.5">
                    His PIN (6 Digits)
                  </label>
                  <input
                    type="text"
                    required
                    pattern="\d{6}"
                    maxLength={6}
                    value={genesisHisPin}
                    onChange={(e) => setGenesisHisPin(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white font-mono text-center tracking-widest focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,255,0.3)] transition hover:opacity-95 active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4" />
                <span>Initialize & Arm Vault</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <p className="text-neutral-400 leading-relaxed">
                Vault is protected. Enter your Master Password to access God-Mode Admin Studio.
              </p>

              <div>
                <label className="block text-neutral-300 font-medium mb-1.5">
                  Master Password <span className="text-cyan-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter Master Password..."
                    required
                    autoFocus
                    className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-4 py-2.5 pr-11 text-white font-mono text-sm placeholder-neutral-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/60 bg-gradient-to-r from-cyan-400 to-cyan-500 py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 shadow-[0_0_25px_rgba(0,240,255,0.3)] transition hover:opacity-95 active:scale-[0.99]"
              >
                <KeyRound className="h-4 w-4 text-neutral-950" />
                <span>Unlock Admin Studio</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN AUTHENTICATED ADMIN STUDIO
  // =========================================================================
  return (
    <div className="relative flex h-[100dvh] w-full flex-col bg-[#070A11] text-neutral-200 overflow-hidden font-sans">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-white/15 bg-neutral-900/90 px-4 py-3 text-xs font-medium text-white shadow-2xl backdrop-blur-xl"
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-neutral-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP COMMAND HEADER */}
      <header className="z-20 shrink-0 border-b border-white/10 bg-neutral-950/80 px-4 sm:px-8 py-3.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          {/* Logo & Studio Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400 font-bold">
                  CHRONOS // CONTROL STUDIO
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Timeline &amp; Vault Orchestrator
              </h1>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <button
              type="button"
              onClick={() => {
                loadDashboardData();
                showToast('Synchronized with backend & Redis.');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-neutral-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-300"
              title="Refresh all overview metrics & stations"
            >
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onExit) {
                  onExit();
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-neutral-300 transition hover:border-white/20 hover:text-white"
              title="Exit Admin Studio and return to CraveBook"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Exit Studio</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (typeof localStorage !== 'undefined') {
                  localStorage.removeItem('chronos_admin_token');
                }
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.removeItem('chronos_admin_token');
                }
                await apiRequest('/auth/admin/logout', { method: 'POST', adminToken }).catch(() => {});
                setAdminToken('');
                setAuthenticated(false);
                setMasterPassword('');
                showToast('Logged out of Admin Studio.');
              }}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300 transition hover:bg-rose-500/20 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* METRICS STRIP */}
      <div className="z-10 shrink-0 border-b border-white/5 bg-neutral-950/40 px-4 sm:px-8 py-3">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-neutral-900/40 p-2.5 sm:p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Compass className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Track Stations
              </div>
              <div className="text-sm sm:text-base font-bold text-white">
                {stations.length} Active Milestones
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-neutral-900/40 p-2.5 sm:p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Decoy Trigger
              </div>
              <div className="text-sm sm:text-base font-bold text-amber-300 font-mono truncate">
                "{overview?.secretWord || newSecretWord || 'cutting chai'}"
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-neutral-900/40 p-2.5 sm:p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <Heart className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Partner PINs
              </div>
              <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Her: 6-Dig</span>
                <span className="text-neutral-500">•</span>
                <span>His: 6-Dig</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-neutral-900/40 p-2.5 sm:p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Watcher Audit
              </div>
              <div className="text-sm sm:text-base font-bold text-white">
                {logs.length} Logged Events
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STUDIO NAVIGATION TABS */}
      <div className="z-10 shrink-0 border-b border-white/10 bg-neutral-950 px-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center gap-1 sm:gap-2 overflow-x-auto py-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('stations')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'stations'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>Stations &amp; Timeline</span>
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
              {stations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'create'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5 text-cyan-400" />
            <span>Station Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('music')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'music'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Music className="h-3.5 w-3.5 text-rose-400" />
            <span>Background Music</span>
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
              {musicTracks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'security'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
            <span>Vault Security</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'logs'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
            <span>Watcher Audit</span>
            <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'backup'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            <Database className="h-3.5 w-3.5 text-cyan-400" />
            <span>Backup &amp; Maintenance</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        <div className="mx-auto max-w-7xl">
          {/* ================================================================= */}
          {/* TAB 1: STATIONS & TIMELINE                                        */}
          {/* ================================================================= */}
          {activeTab === 'stations' && (
            <div className="space-y-5">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-4 backdrop-blur-xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search milestones, captions, or secret letters..."
                    className="w-full rounded-xl border border-white/10 bg-neutral-950/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  <Filter className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                  <select
                    value={filterTheme}
                    onChange={(e) => setFilterTheme(e.target.value)}
                    className="rounded-xl border border-white/10 bg-neutral-950/80 px-3 py-2 text-xs text-neutral-300 focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="all">All Atmospheres ({stations.length})</option>
                    {ENVIRONMENT_THEMES.map((th) => (
                      <option key={th.value} value={th.value}>
                        {th.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>New Station</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPurgeModal(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                    title="Purge all test/seed stations and start completely fresh"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Purge All (Clean Slate)</span>
                  </button>
                </div>
              </div>

              {/* Stations Grid */}
              {filteredStations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-neutral-900/30 py-16 text-center text-neutral-400">
                  <Compass className="h-12 w-12 text-neutral-600 mb-3" />
                  <p className="text-sm font-medium text-neutral-300">
                    No matching stations found
                  </p>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    {searchQuery
                      ? 'Try clearing your search query or theme filter.'
                      : 'Build your first 3D station milestone to populate the journey.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-4 flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 transition"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Create Milestone</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredStations.map((st, idx) => {
                    const theme =
                      ENVIRONMENT_THEMES.find((t) => t.value === st.environmentTheme) ||
                      ENVIRONMENT_THEMES[0];
                    const firstAsset = st.assets?.[0];
                    const formattedDate = st.milestoneDate
                      ? new Date(st.milestoneDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Milestone Date';

                    return (
                      <motion.div
                        key={st._id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-neutral-900/60 p-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-neutral-900/80 shadow-lg"
                      >
                        <div>
                          {/* Station Header Row */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-neutral-300">
                                #{st.trackOrder}
                              </span>
                              <span
                                className={`rounded-lg border px-2 py-0.5 text-[10px] font-medium ${theme.badge}`}
                              >
                                {theme.label}
                              </span>
                            </div>

                            {/* Reorder & Action Controls */}
                            <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={() => handleReorderStation(st, -1)}
                                className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                                title="Move earlier on track"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReorderStation(st, 1)}
                                className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                                title="Move later on track"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setStationToDelete(st)}
                                className="rounded-lg p-1 text-neutral-500 hover:bg-rose-500/15 hover:text-rose-400 transition"
                                title="Delete station milestone"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Media Preview Card */}
                          <div
                            onClick={() => {
                              setPreviewStationModal(st);
                              setModalPolaroidFlipped(false);
                            }}
                            className="cursor-pointer relative mb-3 overflow-hidden rounded-xl border border-white/10 bg-neutral-950 aspect-[16/10] group/media"
                          >
                            {firstAsset?.url ? (
                              <img
                                src={optimizeCloudinaryUrl(firstAsset.url)}
                                alt={st.stationTitle}
                                className="h-full w-full object-cover transition duration-500 group-hover/media:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950 text-neutral-600">
                                <ImageIcon className="h-8 w-8 mb-1" />
                                <span className="text-[10px] uppercase font-mono">No Media Attached</span>
                              </div>
                            )}

                            {/* Hover overlay hint */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/media:opacity-100 transition">
                              <span className="flex items-center gap-1 rounded-full border border-white/20 bg-neutral-900/80 px-3 py-1 text-[11px] font-medium text-white shadow-xl backdrop-blur-md">
                                <Maximize2 className="h-3 w-3" /> Preview Station
                              </span>
                            </div>

                            {/* Date Badge */}
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg border border-black/40 bg-black/60 px-2 py-0.5 text-[10px] font-mono text-neutral-300 backdrop-blur-md">
                              <Calendar className="h-3 w-3 text-cyan-400" />
                              <span>{formattedDate}</span>
                            </div>
                          </div>

                          {/* Title & Caption */}
                          <h3 className="font-serif text-base font-semibold text-white tracking-wide truncate">
                            {st.stationTitle}
                          </h3>
                          {st.assets?.[0]?.caption && (
                            <p className="mt-1 text-xs text-neutral-400 line-clamp-1 italic">
                              "{st.assets[0].caption}"
                            </p>
                          )}
                          {st.secretLetter && (
                            <p className="mt-1.5 text-[11px] text-neutral-400 line-clamp-2">
                              <span className="text-amber-400 font-medium">Flip Note:</span>{' '}
                              {st.secretLetter}
                            </p>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-500">
                          <span>{st.assets?.length || 0} Assets Deployed</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewStationModal(st);
                              setModalPolaroidFlipped(false);
                            }}
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: STATION STUDIO (BUILDER & REAL-TIME PREVIEW)              */}
          {/* ================================================================= */}
          {activeTab === 'create' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* LEFT COLUMN: BUILDER FORM */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 sm:p-6 backdrop-blur-xl lg:col-span-7">
                <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Station &amp; Milestone Studio
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Craft memory signboards and upload Cloudinary media to the 3D track.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateStation} className="space-y-4 text-xs">
                  {/* Station Title */}
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1.5">
                      Milestone / Station Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={stationTitle}
                      onChange={(e) => setStationTitle(e.target.value)}
                      placeholder="e.g. First Stargazing Trip to Ladakh"
                      className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white placeholder-neutral-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-serif text-sm"
                    />
                  </div>

                  {/* Date and 3D Atmosphere */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-neutral-300 font-medium mb-1.5 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                        Milestone Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={milestoneDate}
                        onChange={(e) => setMilestoneDate(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-300 font-medium mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        Atmosphere Theme
                      </label>
                      <select
                        value={environmentTheme}
                        onChange={(e) => setEnvironmentTheme(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white font-medium focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      >
                        {ENVIRONMENT_THEMES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Atmosphere Visual Pills */}
                  <div>
                    <label className="block text-neutral-400 text-[11px] mb-2 font-medium">
                      Select Atmosphere Visual Style
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ENVIRONMENT_THEMES.map((theme) => {
                        const isSelected = environmentTheme === theme.value;
                        return (
                          <button
                            key={theme.value}
                            type="button"
                            onClick={() => setEnvironmentTheme(theme.value)}
                            className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition ${
                              isSelected
                                ? 'border-cyan-400 bg-cyan-500/15 shadow-[0_0_15px_rgba(0,240,255,0.15)] text-white'
                                : 'border-white/10 bg-neutral-950/40 text-neutral-400 hover:border-white/20 hover:text-neutral-200'
                            }`}
                          >
                            <span className="font-semibold text-xs text-white">
                              {theme.label}
                            </span>
                            <span className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                              {theme.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Drag and Drop Media Upload Zone */}
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1.5 flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5 text-cyan-400" />
                      Billboard &amp; Polaroid Media Asset
                    </label>

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        if (e.dataTransfer.files?.[0]) {
                          setMediaFile(e.dataTransfer.files[0]);
                        }
                      }}
                      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
                        dragActive
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : mediaFile
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-white/15 bg-neutral-950/60 hover:border-white/25'
                      }`}
                    >
                      {mediaLocalPreview ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative overflow-hidden rounded-xl border border-white/20 max-h-36 max-w-full">
                            <img
                              src={mediaLocalPreview}
                              alt="Local preview"
                              className="h-32 w-auto object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setMediaFile(null);
                                setMediaLocalPreview(null);
                              }}
                              className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-rose-600 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="font-mono text-[11px] text-emerald-400 font-medium">
                            Ready: {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-2">
                            <Upload className="h-5 w-5" />
                          </div>
                          <p className="font-medium text-neutral-200">
                            Drag &amp; drop photo (.jpg, .png), video (.mp4) or voice note (.m4a)
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            High-res assets are automatically compressed and cached for optimal 3D rendering.
                          </p>
                          <label className="mt-3 cursor-pointer rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20">
                            Browse Local File
                            <input
                              type="file"
                              accept="image/*,video/*,audio/mp4,audio/mpeg,audio/x-m4a,.m4a,.mp3"
                              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Or Direct URL Input */}
                  <div>
                    <label className="block text-neutral-400 text-[11px] font-medium mb-1">
                      Or Direct Media URL (Cloudinary / Unsplash)
                    </label>
                    <input
                      type="url"
                      value={mediaUrlInput}
                      onChange={(e) => setMediaUrlInput(e.target.value)}
                      placeholder="https://res.cloudinary.com/..."
                      className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2 text-white placeholder-neutral-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono text-xs"
                    />
                  </div>

                  {/* Billboard Caption */}
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1">
                      Billboard Caption (Shown on Track Sign)
                    </label>
                    <input
                      type="text"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="e.g. That midnight cup of cutting chai under the pouring rain"
                      className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white placeholder-neutral-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </div>

                  {/* Secret Polaroid Flip Letter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-neutral-300 font-medium flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        Secret Polaroid Flip Letter
                      </label>
                      <span className="text-[10px] text-neutral-500">
                        {secretLetter.length} characters
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={secretLetter}
                      onChange={(e) => setSecretLetter(e.target.value)}
                      placeholder="Hidden love letter revealed when the 3D polaroid card is tapped & flipped 180°..."
                      className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white placeholder-neutral-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 font-serif leading-relaxed"
                    />
                  </div>

                  {/* Upload Progress Bar */}
                  {uploadProgress > 0 && (
                    <div className="rounded-xl border border-white/10 bg-neutral-950/80 p-3">
                      <div className="flex justify-between text-xs font-mono text-cyan-400 mb-1.5">
                        <span>Deploying to Cloudinary &amp; Redis...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Submit Deploy Button */}
                  <button
                    type="submit"
                    disabled={isDeploying}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-gradient-to-r from-cyan-400 to-cyan-500 py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 shadow-[0_0_25px_rgba(0,240,255,0.25)] transition hover:opacity-95 disabled:opacity-40"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Deploy Station to 3D Track</span>
                  </button>
                </form>
              </div>

              {/* RIGHT COLUMN: REAL-TIME INTERACTIVE POLAROID & SIGNBOARD PREVIEW */}
              <div className="flex flex-col gap-4 lg:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                        Live 3D Card Simulation
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLivePreviewFlipped(!isLivePreviewFlipped)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition"
                    >
                      {isLivePreviewFlipped ? 'View Front Photo' : 'Flip to Secret Letter'}
                    </button>
                  </div>

                  {/* Interactive Flip Card Container */}
                  <div className="flex justify-center py-2">
                    <div
                      onClick={() => setIsLivePreviewFlipped(!isLivePreviewFlipped)}
                      className="cursor-pointer group relative w-64 rounded-xl border border-white/20 bg-[#FAF7F2] p-3 text-neutral-900 shadow-2xl transition duration-500"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: isLivePreviewFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      }}
                    >
                      {/* FRONT OF POLAROID */}
                      <div
                        className="flex flex-col items-center"
                        style={{ backfaceVisibility: 'hidden' }}
                      >
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-200">
                          {mediaLocalPreview || mediaUrlInput ? (
                            <img
                              src={mediaLocalPreview || mediaUrlInput}
                              alt="Station billboard"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-100 text-neutral-400">
                              <ImageIcon className="h-10 w-10 mb-1" />
                              <span className="font-mono text-[10px]">Photo Preview</span>
                            </div>
                          )}
                          <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-mono text-white backdrop-blur-sm">
                            {currentThemeData.label}
                          </div>
                        </div>

                        <div className="mt-3 w-full text-center">
                          <h4 className="font-serif text-sm font-bold text-neutral-900 line-clamp-1">
                            {stationTitle || 'Untitled Station'}
                          </h4>
                          <p className="font-mono text-[10px] text-neutral-500 mt-0.5">
                            {milestoneDate || 'Date Not Set'}
                          </p>
                          {caption && (
                            <p className="mt-1.5 text-[11px] text-neutral-700 italic line-clamp-2 px-1">
                              "{caption}"
                            </p>
                          )}
                        </div>

                        <span className="mt-2 text-[9px] uppercase tracking-widest text-neutral-400">
                          Tap to flip card ↻
                        </span>
                      </div>

                      {/* BACK OF POLAROID (SECRET LETTER) */}
                      <div
                        className="absolute inset-0 flex flex-col justify-between rounded-xl bg-[#FDFBF7] p-5 text-neutral-900"
                        style={{
                          backfaceVisibility: 'hidden',
                          transform: 'rotateY(180deg)',
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between border-b border-rose-200 pb-2 mb-3">
                            <span className="font-mono text-[10px] uppercase font-bold text-rose-500">
                              Secret Memory Note
                            </span>
                            <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                          </div>
                          <p className="font-serif text-xs text-neutral-800 leading-relaxed italic whitespace-pre-wrap">
                            {secretLetter ||
                              'Your secret flip note will appear here when tapped in the 3D journey...'}
                          </p>
                        </div>

                        <div className="border-t border-neutral-200 pt-2 text-center font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
                          Chronos Love Express • Tap to flip back
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Station Signboard Simulation */}
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-bold block mb-2">
                    Station Platform Signboard Look
                  </span>
                  <div className="rounded-xl border border-rose-900/40 bg-neutral-950 p-4 text-center">
                    <div className="font-mono text-[10px] tracking-widest text-rose-400 uppercase">
                      STATION • {milestoneDate || '2026-11-12'}
                    </div>
                    <div className="mt-1 font-serif text-lg font-bold text-white tracking-wide">
                      {stationTitle || 'Milestone Title'}
                    </div>
                    {caption && (
                      <div className="mt-1 text-xs text-amber-300 italic">
                        {caption}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB: BACKGROUND MUSIC (VAULT CENTRAL SOUNDTRACK)                   */}
          {/* ================================================================= */}
          {activeTab === 'music' && (
            <div className="space-y-6">
              {/* Music Banner */}
              <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-r from-rose-950/40 via-neutral-900/60 to-purple-950/30 p-5 backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-mono uppercase tracking-wider">
                      <Music className="h-4 w-4" />
                      <span>Central Ambient Audio Engine</span>
                    </div>
                    <h2 className="mt-1 text-lg font-bold text-white">Vault Journey Music System</h2>
                    <p className="mt-1 text-xs text-neutral-400 max-w-2xl leading-relaxed">
                      Upload soft background songs, ambient tunes, or instrumental melodies. Tracks added here automatically play in an endless continuous queue throughout the entire Vault journey, looping across the 3D train, station stops, and coupe.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-rose-300 text-xs font-mono">
                    <Radio className="h-4 w-4 animate-pulse text-rose-400" />
                    <span>{musicTracks.length} Active Tracks in Queue</span>
                  </div>
                </div>
              </div>

              {/* Upload New Track Form */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                  <FileUp className="h-4 w-4 text-rose-400" />
                  <span>Add Song to Journey Queue</span>
                </h3>

                <form onSubmit={handleUploadMusic} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Track Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={newTrackTitle}
                        onChange={(e) => setNewTrackTitle(e.target.value)}
                        placeholder="e.g. Midnight Nostalgia / Soft Rain Melodies"
                        required
                        className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:border-rose-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Artist / Composer
                      </label>
                      <input
                        type="text"
                        value={newTrackArtist}
                        onChange={(e) => setNewTrackArtist(e.target.value)}
                        placeholder="e.g. Ludovico Einaudi / Our Memory"
                        className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:border-rose-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Option A: Upload Audio File (MP3, WAV, AAC)
                      </label>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewTrackFile(file);
                            if (!newTrackTitle) {
                              setNewTrackTitle(file.name.replace(/\.[^/.]+$/, ''));
                            }
                          }
                        }}
                        className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-500/20 file:px-3 file:py-1 file:text-xs file:font-medium file:text-rose-300 hover:file:bg-rose-500/30"
                      />
                      {newTrackFile && (
                        <p className="mt-1 text-[11px] text-rose-300 font-mono">
                          Selected: {newTrackFile.name} ({(newTrackFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                        Option B: Or Direct Audio URL
                      </label>
                      <input
                        type="url"
                        value={newTrackUrl}
                        onChange={(e) => setNewTrackUrl(e.target.value)}
                        placeholder="https://.../song.mp3"
                        disabled={Boolean(newTrackFile)}
                        className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:border-rose-400 focus:outline-none disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isUploadingMusic || (!newTrackTitle.trim() || (!newTrackFile && !newTrackUrl.trim()))}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(244,63,94,0.3)] transition hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                    >
                      {isUploadingMusic ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Uploading Track...</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" />
                          <span>Add to Journey Queue</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Music Queue List */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Radio className="h-4 w-4 text-rose-400" />
                    <span>Current Soundtrack Queue</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => loadMusicTracks()}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/10"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${musicLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {musicTracks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Music className="h-10 w-10 text-neutral-600 mb-3" />
                    <p className="text-xs font-medium text-neutral-300">No music tracks uploaded yet</p>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-sm">
                      Upload your favorite soft songs above. Once added, the Vault will automatically play them one by one in a continuous loop when the user enters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {musicTracks.map((track, idx) => {
                      const isPlaying = playingTrackId === track._id;
                      return (
                        <div
                          key={track._id || idx}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                            isPlaying
                              ? 'border-rose-500/40 bg-rose-500/10'
                              : 'border-white/5 bg-neutral-950/60 hover:border-white/15'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 font-mono text-xs text-neutral-400">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                                <span>{track.title}</span>
                                {isPlaying && (
                                  <span className="flex items-center gap-0.5">
                                    <span className="h-2 w-0.5 bg-rose-400 animate-pulse"></span>
                                    <span className="h-3 w-0.5 bg-rose-400 animate-pulse delay-75"></span>
                                    <span className="h-1.5 w-0.5 bg-rose-400 animate-pulse delay-150"></span>
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-neutral-400 truncate">
                                {track.artist || 'Ambient'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => togglePreviewTrack(track)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition ${
                                isPlaying
                                  ? 'border-rose-500/50 bg-rose-500/20 text-rose-300'
                                  : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                              }`}
                              title={isPlaying ? 'Pause Preview' : 'Play Preview'}
                            >
                              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteMusic(track._id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                              title="Delete track"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: VAULT SECURITY & DYNAMIC PASSWORDS                         */}
          {/* ================================================================= */}
          {activeTab === 'security' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-7">
                {/* Credentials Update Card */}
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 backdrop-blur-xl">
                  <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight">
                        Vault Access &amp; Decoy Triggers
                      </h2>
                      <p className="text-xs text-neutral-400">
                        Update the secret recipe search word and partner 6-digit access PINs.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateCredentials} className="space-y-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-neutral-300 font-medium">
                          Decoy Search Trigger Word *
                        </label>
                        <button
                          type="button"
                          onClick={handleCopyTrigger}
                          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                        >
                          {copiedTrigger ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedTrigger ? 'Copied' : 'Copy Word'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={30}
                        value={newSecretWord}
                        onChange={(e) => setNewSecretWord(e.target.value)}
                        placeholder="e.g. cutting chai"
                        className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-cyan-300 font-mono font-bold focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 text-sm"
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">
                        When typed into the decoy food recipe search bar, this phrase automatically opens the secret vault PIN pad.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-neutral-300 font-medium">
                            Her PIN (6 Digits)
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowHerPin(!showHerPin)}
                            className="text-neutral-500 hover:text-neutral-300 text-[11px]"
                          >
                            {showHerPin ? 'Mask' : 'Reveal'}
                          </button>
                        </div>
                        <input
                          type={showHerPin ? 'text' : 'password'}
                          pattern="\d{6}"
                          maxLength={6}
                          value={newHerPin}
                          onChange={(e) => setNewHerPin(e.target.value)}
                          placeholder="•••••• (Leave blank to keep)"
                          className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white font-mono tracking-widest text-center focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-neutral-300 font-medium">
                            His PIN (6 Digits)
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowHisPin(!showHisPin)}
                            className="text-neutral-500 hover:text-neutral-300 text-[11px]"
                          >
                            {showHisPin ? 'Mask' : 'Reveal'}
                          </button>
                        </div>
                        <input
                          type={showHisPin ? 'text' : 'password'}
                          pattern="\d{6}"
                          maxLength={6}
                          value={newHisPin}
                          onChange={(e) => setNewHisPin(e.target.value)}
                          placeholder="•••••• (Leave blank to keep)"
                          className="w-full rounded-xl border border-white/10 bg-neutral-950/80 px-3.5 py-2.5 text-white font-mono tracking-widest text-center focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 text-sm"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-gradient-to-r from-cyan-400 to-cyan-500 py-3 text-xs font-bold uppercase tracking-wider text-neutral-950 shadow-[0_0_20px_rgba(0,240,255,0.2)] transition hover:opacity-95"
                    >
                      <Check className="h-4 w-4" />
                      <span>Save Updated Passwords &amp; PINs</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Explanatory Architecture Card */}
              <div className="space-y-4 lg:col-span-5">
                <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl text-xs space-y-3">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyan-400" />
                    Two-Tier Stealth Architecture
                  </h3>
                  <div className="space-y-2.5 text-neutral-400 leading-relaxed">
                    <p>
                      <strong className="text-neutral-200">Tier 1: Decoy CraveBook</strong>
                      <br />
                      To anyone looking at your screen, the webapp presents a real, functioning recipe book with meal plans and search.
                    </p>
                    <p>
                      <strong className="text-neutral-200">Tier 2: The Secret Vault</strong>
                      <br />
                      Typing the secret trigger word opens the biometric-style PIN pad. Entering both Her PIN or His PIN unlocks your shared couple journey, live calling, and synchronized cinema.
                    </p>
                    <p>
                      <strong className="text-neutral-200">Tier 3: God-Mode Admin Studio</strong>
                      <br />
                      Direct access via <code className="text-cyan-400 font-mono">/prodev</code> or in-app search keyword using the Master Password allows milestone orchestration and direct backup restoration.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* ================================================================= */}
          {/* TAB 4: WATCHER AUDIT LOGS                                         */}
          {/* ================================================================= */}
          {activeTab === 'logs' && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      Security &amp; Activity Log
                    </h2>
                    <p className="text-xs text-neutral-400">
                      Chronological tamper-evident audit trail of vault accesses and station updates.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Search log messages..."
                      className="w-full rounded-xl border border-white/10 bg-neutral-950/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <select
                    value={logActorFilter}
                    onChange={(e) => setLogActorFilter(e.target.value)}
                    className="rounded-xl border border-white/10 bg-neutral-950/80 px-2.5 py-1.5 text-xs text-neutral-300 focus:border-cyan-400 focus:outline-none"
                  >
                    {logActors.map((actor) => (
                      <option key={actor} value={actor}>
                        {actor === 'all' ? 'All Actors' : actor}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      loadDashboardData();
                      showToast('Logs refreshed.');
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-300 hover:text-white transition"
                    title="Refresh logs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 font-mono">
                  No logged events match the filter criteria.
                </div>
              ) : (
                <div className="max-h-[580px] overflow-y-auto space-y-2 pr-1 text-xs font-mono">
                  {filteredLogs.map((log, i) => {
                    const isSystem = log.actor?.toLowerCase() === 'system';
                    const isAdmin = log.actor?.toLowerCase().includes('admin');
                    const badgeClass = isAdmin
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      : isSystem
                      ? 'border-purple-500/30 bg-purple-500/10 text-purple-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

                    return (
                      <div
                        key={log._id || i}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-xl border border-white/5 bg-neutral-950/60 p-3 hover:border-white/10 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0 ${badgeClass}`}
                          >
                            {log.actor || 'ANON'}
                          </span>
                          <span className="text-neutral-200 truncate">
                            {log.action}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500 shrink-0 font-sans">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}



          {/* ================================================================= */}
          {/* TAB 5: BACKUP & MAINTENANCE                                       */}
          {/* ================================================================= */}
          {activeTab === 'backup' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Export Backup Card */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-3">
                    <Download className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Export Full Journey Backup
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Download an offline JSON archive containing all timeline stations, asset manifests, track order indices, and milestone descriptions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/15 py-3 text-xs font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/25 transition shadow-[0_0_20px_rgba(0,240,255,0.15)]"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Backup JSON</span>
                </button>
              </div>

              {/* Restore Backup Card */}
              <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 backdrop-blur-xl flex flex-col justify-between">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-3">
                    <FileUp className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Restore From Backup JSON
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    Upload a previously exported <code className="text-emerald-400 font-mono">chronos_backup.json</code> to restore stations and timeline assets.
                  </p>
                </div>

                <label className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 py-3 text-xs font-bold uppercase tracking-wider text-emerald-300 hover:bg-emerald-500/25 transition shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                  <FileUp className="h-4 w-4" />
                  <span>Select Backup File to Restore</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Lockdown Reset Card */}
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 backdrop-blur-xl md:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-rose-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Danger Zone: Simulate Genesis Lockdown Reset
                    </h4>
                    <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                      Resets the admin session and flags the vault as requiring initial Genesis initialization.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetGenesisModal(true)}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-300 hover:bg-rose-500/30 transition"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reset to Genesis</span>
                  </button>
                </div>
              </div>
            </div>
          )}


        </div>
      </main>

      {/* ===================================================================== */}
      {/* MODAL 1: PREVIEW STATION INSPECTOR                                    */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {previewStationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl rounded-2xl border border-white/20 bg-neutral-900 p-6 shadow-2xl text-white"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">
                    Station #{previewStationModal.trackOrder} Inspector
                  </span>
                  <h3 className="font-serif text-lg font-bold text-white">
                    {previewStationModal.stationTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewStationModal(null)}
                  className="rounded-lg p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Flip Polaroid inside Modal */}
              <div className="flex justify-center py-2">
                <div
                  onClick={() => setModalPolaroidFlipped(!modalPolaroidFlipped)}
                  className="cursor-pointer relative w-72 rounded-xl border border-white/20 bg-[#FAF7F2] p-4 text-neutral-900 shadow-2xl transition duration-500"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: modalPolaroidFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front */}
                  <div style={{ backfaceVisibility: 'hidden' }}>
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-200">
                      {previewStationModal.assets?.[0]?.url ? (
                        <img
                          src={optimizeCloudinaryUrl(previewStationModal.assets[0].url)}
                          alt={previewStationModal.stationTitle}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-neutral-400">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-center">
                      <h4 className="font-serif text-sm font-bold text-neutral-900">
                        {previewStationModal.stationTitle}
                      </h4>
                      <p className="font-mono text-[10px] text-neutral-500 mt-0.5">
                        {previewStationModal.milestoneDate
                          ? new Date(previewStationModal.milestoneDate).toLocaleDateString(
                              'en-US',
                              { month: 'short', day: 'numeric', year: 'numeric' }
                            )
                          : ''}
                      </p>
                      {previewStationModal.assets?.[0]?.caption && (
                        <p className="mt-1 text-xs text-neutral-700 italic">
                          "{previewStationModal.assets[0].caption}"
                        </p>
                      )}
                    </div>
                    <span className="mt-3 block text-center text-[9px] uppercase tracking-widest text-neutral-400">
                      Tap card to flip ↻
                    </span>
                  </div>

                  {/* Back */}
                  <div
                    className="absolute inset-0 flex flex-col justify-between rounded-xl bg-[#FDFBF7] p-5 text-neutral-900"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between border-b border-rose-200 pb-2 mb-3">
                        <span className="font-mono text-[10px] uppercase font-bold text-rose-500">
                          Secret Flip Message
                        </span>
                        <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                      </div>
                      <p className="font-serif text-xs text-neutral-800 leading-relaxed italic whitespace-pre-wrap">
                        {previewStationModal.secretLetter ||
                          'No secret letter was provided for this milestone.'}
                      </p>
                    </div>
                    <div className="border-t border-neutral-200 pt-2 text-center font-mono text-[9px] text-neutral-400 uppercase tracking-widest">
                      Tap to flip back
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setPreviewStationModal(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 2: DELETE CONFIRMATION                                         */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {stationToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-neutral-900 p-6 shadow-2xl text-white"
            >
              <div className="flex items-center gap-3 mb-3 text-rose-400">
                <div className="rounded-xl bg-rose-500/10 p-2.5">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold tracking-tight text-white">
                  Purge Station Milestone?
                </h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-white">"{stationToDelete.stationTitle}"</strong>?
                This action purges all associated photos, billboards, and letters from the 3D track and Cloudinary cache.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStationToDelete(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteStation}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 3: RESET TO GENESIS CONFIRMATION                                */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {showResetGenesisModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-neutral-900 p-6 shadow-2xl text-white"
            >
              <div className="flex items-center gap-3 mb-3 text-rose-400">
                <div className="rounded-xl bg-rose-500/10 p-2.5">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold tracking-tight text-white">
                  Reset Vault to Genesis Lockdown?
                </h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                This will terminate your active God-Mode token and mark the vault as needing fresh Genesis credentials on next visit.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResetGenesisModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetToGenesis}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Confirm Lockdown Reset</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 4: PURGE ALL STATIONS (CLEAN SLATE) CONFIRMATION               */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {showPurgeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-neutral-900 p-6 shadow-2xl text-white"
            >
              <div className="flex items-center gap-3 mb-3 text-rose-400">
                <div className="rounded-xl bg-rose-500/10 p-2.5">
                  <AlertTriangle className="h-6 w-6 text-rose-400" />
                </div>
                <h3 className="text-base font-bold tracking-tight text-white">
                  Purge All Stations (Clean Slate)?
                </h3>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                This will delete <strong className="text-rose-400">ALL existing stations and test milestones</strong> from the database. The 3D timeline will be completely empty so you can add only your own real, personal memories.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPurgeModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={handlePurgeAllStations}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-500/50 bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)] transition disabled:opacity-50"
                >
                  {isPurging ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isPurging ? 'Purging...' : 'Yes, Purge Everything'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
