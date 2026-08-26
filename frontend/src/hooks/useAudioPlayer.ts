import { useState, useEffect, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

export type PlaybackRate = 1 | 1.2 | 1.5 | 2;

export interface AudioPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: PlaybackRate;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  bufferedPercent: number;
  error: string | null;
}

export interface AudioPlayerControls {
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  stop: () => void;
  seek: (timeInSeconds: number) => void;
  skip: (seconds: number) => void;
  setPlaybackRate: (rate: PlaybackRate) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export type UseAudioPlayerReturn = AudioPlayerState & AudioPlayerControls;

export const useAudioPlayer = (audioPath: string | null): UseAudioPlayerReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState<PlaybackRate>(1);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // Initialize or update audio source when audioPath changes
  useEffect(() => {
    if (!audioPath) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBufferedPercent(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      // Reset playback state so a previous meeting's progress never leaks into the new one
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setBufferedPercent(0);
      setError(null);

      // Create or reuse audio element
      const audioUrl = convertFileSrc(audioPath);
      let audio = audioRef.current;

      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      } else {
        audio.pause();
      }

      audio.preload = 'metadata';
      audio.playbackRate = playbackRate;
      audio.volume = isMuted ? 0 : volume;

      const handleLoadedMetadata = () => {
        if (!audio) return;
        const loadedDuration = audio.duration || 0;
        setDuration(loadedDuration);
        setIsLoading(false);

        const pendingSeek = pendingSeekRef.current;
        pendingSeekRef.current = null;
        if (pendingSeek !== null && loadedDuration > 0) {
          const clampedTime = Math.min(pendingSeek, loadedDuration);
          audio.currentTime = clampedTime;
          setCurrentTime(clampedTime);
        }
      };

      const handleTimeUpdate = () => {
        if (audio) {
          setCurrentTime(audio.currentTime);
        }
      };

      const handleProgress = () => {
        if (audio && audio.duration > 0 && audio.buffered.length > 0) {
          try {
            const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
            setBufferedPercent(Math.min(100, (bufferedEnd / audio.duration) * 100));
          } catch (e) {
            // Buffer indexing error can happen if ranges reset
          }
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      const handleWaiting = () => {
        setIsLoading(true);
      };

      const handleCanPlay = () => {
        setIsLoading(false);
      };

      const handleError = () => {
        const audioErr = audio?.error;
        console.error('Audio element error:', audioErr);
        setError('Unable to play audio file');
        setIsLoading(false);
        setIsPlaying(false);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('progress', handleProgress);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('waiting', handleWaiting);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('error', handleError);

      pendingSeekRef.current = null;
      audio.src = audioUrl;
      audio.load();

      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('progress', handleProgress);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('waiting', handleWaiting);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('error', handleError);
      };
    } catch (err) {
      console.error('Failed to initialize audio player:', err);
      setError('Failed to load audio file');
      setIsLoading(false);
    }
  }, [audioPath]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      setError(null);
      audio.playbackRate = playbackRate;
      playPromiseRef.current = audio.play();
      await playPromiseRef.current;
      setIsPlaying(true);
    } catch (err: any) {
      // AbortError is common when play() is immediately followed by pause()
      if (err.name !== 'AbortError') {
        console.error('Error playing audio:', err);
        setError('Failed to play audio');
      }
      setIsPlaying(false);
    } finally {
      playPromiseRef.current = null;
    }
  }, [playbackRate]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.pause();
      setIsPlaying(false);
    } catch (err) {
      console.error('Error pausing audio:', err);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      pause();
    } else {
      await play();
    }
  }, [isPlaying, play, pause]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    } catch (err) {
      console.error('Error stopping audio:', err);
    }
  }, []);

  const seek = useCallback((timeInSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Before metadata arrives the duration is unknown, so defer the seek to loadedmetadata
    const knownDuration = Number.isFinite(audio.duration) ? audio.duration : duration;
    if (!knownDuration) {
      pendingSeekRef.current = Math.max(0, timeInSeconds);
      setCurrentTime(pendingSeekRef.current);
      return;
    }

    try {
      const clampedTime = Math.max(0, Math.min(timeInSeconds, knownDuration));
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    } catch (err) {
      console.error('Error seeking audio:', err);
    }
  }, [duration]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const targetTime = (audio.currentTime || currentTime) + seconds;
    seek(targetTime);
  }, [currentTime, seek]);

  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
      if (clampedVolume > 0 && isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (audioRef.current) {
        audioRef.current.muted = nextMuted;
      }
      return nextMuted;
    });
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    isLoading,
    bufferedPercent,
    error,
    play,
    pause,
    togglePlay,
    stop,
    seek,
    skip,
    setPlaybackRate,
    setVolume,
    toggleMute,
  };
};
