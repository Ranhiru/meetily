"use client";

import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  FolderOpen,
  X,
  Loader2,
  Gauge,
  AlertCircle,
  LocateFixed,
  LocateOff
} from 'lucide-react';
import { PlaybackRate, UseAudioPlayerReturn } from '@/hooks/useAudioPlayer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface AudioPlayerProps {
  /** Playback state and controls, owned by the parent so they outlive this component */
  player: UseAudioPlayerReturn;
  hasAudio: boolean;
  /** Whether the transcript scrolls to follow the playing segment */
  isFollowing?: boolean;
  onToggleFollow?: () => void;
  meetingTitle?: string;
  onOpenFolder?: () => void;
  onClose?: () => void;
  className?: string;
}

/**
 * Formats time in seconds to mm:ss or hh:mm:ss
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';

  const totalSecs = Math.floor(seconds);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const PLAYBACK_RATES: PlaybackRate[] = [1, 1.2, 1.5, 2];

export function AudioPlayer({
  player,
  hasAudio,
  isFollowing = false,
  onToggleFollow,
  meetingTitle,
  onOpenFolder,
  onClose,
  className = '',
}: AudioPlayerProps) {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Map a pointer position on the progress bar to a track time
  const timeFromClientX = (clientX: number): number | null => {
    if (!progressBarRef.current || player.duration <= 0) return null;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return percentage * player.duration;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const targetTime = timeFromClientX(e.clientX);
    if (targetTime === null) return;

    setIsScrubbing(true);
    setScrubValue(targetTime);
    player.seek(targetTime);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveTime = timeFromClientX(moveEvent.clientX);
      if (moveTime === null) return;
      setScrubValue(moveTime);
      player.seek(moveTime);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const displayTime = isScrubbing ? scrubValue : player.currentTime;
  const progressPercent = player.duration > 0 ? (displayTime / player.duration) * 100 : 0;

  const getVolumeIcon = () => {
    if (player.isMuted || player.volume === 0) return <VolumeX size={16} />;
    if (player.volume < 0.5) return <Volume1 size={16} />;
    return <Volume2 size={16} />;
  };

  return (
    <div
      className={`bg-white border border-gray-200 shadow-sm rounded-lg p-3 transition-all ${className}`}
      role="region"
      aria-label="Audio Player"
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-700 truncate">
            {meetingTitle ? `Recording: ${meetingTitle}` : 'Meeting Recording'}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Speed Selector Dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                  >
                    <Gauge size={13} className="text-gray-500" />
                    <span>{player.playbackRate}x</span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Playback Speed</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-[90px]">
              {PLAYBACK_RATES.map((rate) => (
                <DropdownMenuItem
                  key={rate}
                  onClick={() => player.setPlaybackRate(rate)}
                  className={`text-xs flex items-center justify-between cursor-pointer ${
                    player.playbackRate === rate ? 'font-bold text-blue-600 bg-blue-50' : ''
                  }`}
                >
                  <span>{rate}x</span>
                  {player.playbackRate === rate && <span className="text-blue-600 text-xs">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Follow the playing segment in the transcript */}
          {onToggleFollow && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleFollow}
                  aria-pressed={isFollowing}
                  className={`h-7 w-7 p-0 ${
                    isFollowing
                      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {isFollowing ? <LocateFixed size={14} /> : <LocateOff size={14} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFollowing ? 'Stop following the transcript' : 'Follow along in the transcript'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Open Folder in File Manager */}
          {onOpenFolder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onOpenFolder}
                  className="h-7 w-7 p-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <FolderOpen size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open Recording Folder</TooltipContent>
            </Tooltip>
          )}

          {/* Close/Minimize Player */}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  <X size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Hide Player</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Error state alert */}
      {player.error && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="truncate">{player.error}</span>
          {onOpenFolder && (
            <button
              onClick={onOpenFolder}
              className="ml-auto underline text-xs font-medium text-red-700 hover:text-red-800 flex-shrink-0"
            >
              Open Folder
            </button>
          )}
        </div>
      )}

      {/* Progress Bar / Scrubber */}
      <div className="space-y-1 mb-2">
        <div
          ref={progressBarRef}
          onMouseDown={handleMouseDown}
          className="relative h-2 w-full bg-gray-200 hover:h-2.5 rounded-full cursor-pointer transition-all group overflow-hidden"
          title="Seek"
        >
          {/* Buffered Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-gray-300 rounded-full transition-all"
            style={{ width: `${player.bufferedPercent}%` }}
          />
          {/* Current Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Time display */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono select-none px-0.5">
          <span>{formatTime(displayTime)}</span>
          <span>{formatTime(player.duration)}</span>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-1 pt-1">
        {/* Left: Playback Controls */}
        <div className="flex items-center gap-1.5">
          {/* Skip Back -10s */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.skip(-10)}
                disabled={!hasAudio}
                className="h-8 w-8 p-0 text-gray-700"
              >
                <RotateCcw size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip back 10s</TooltipContent>
          </Tooltip>

          {/* Play / Pause Toggle Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={player.togglePlay}
                disabled={!hasAudio || player.isLoading}
                aria-label={player.isPlaying ? 'Pause' : 'Play'}
                className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
              >
                {player.isLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : player.isPlaying ? (
                  <Pause size={15} className="fill-current" />
                ) : (
                  <Play size={15} className="fill-current" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{player.isPlaying ? 'Pause' : 'Play'}</TooltipContent>
          </Tooltip>

          {/* Skip Forward +10s */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => player.skip(10)}
                disabled={!hasAudio}
                className="h-8 w-8 p-0 text-gray-700"
              >
                <RotateCw size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip forward 10s</TooltipContent>
          </Tooltip>
        </div>

        {/* Right: Volume & Fast forward cycle button */}
        <div className="flex items-center gap-1">
          {/* Quick Speed Cycle Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentIndex = PLAYBACK_RATES.indexOf(player.playbackRate);
                  const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
                  player.setPlaybackRate(nextRate);
                }}
                className="h-8 px-2 text-xs font-medium text-gray-700"
              >
                {player.playbackRate}x
              </Button>
            </TooltipTrigger>
            <TooltipContent>Click to cycle speed</TooltipContent>
          </Tooltip>

          {/* Volume Mute & Slider */}
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={player.toggleMute}
                  className="h-8 w-8 p-0 text-gray-600 hover:text-gray-900"
                >
                  {getVolumeIcon()}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{player.isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
            </Tooltip>

            {showVolumeSlider && (
              <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 shadow-md rounded-md p-2 flex items-center gap-2 z-20">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={player.isMuted ? 0 : player.volume}
                  onChange={(e) => player.setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-[10px] font-mono text-gray-500 w-6">
                  {Math.round((player.isMuted ? 0 : player.volume) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
